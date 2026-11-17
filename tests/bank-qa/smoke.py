#!/usr/bin/env python3
"""Playwright smoke/regression for the canonical TransFi bank flows.

Usage:
    python3 -m pip install playwright
    python3 -m playwright install chromium
    python3 tests/bank-qa/smoke.py

Serves the actual repository over localhost to exercise iframe postMessage.
Does not call provider APIs or mutate the mock balances.
"""
import asyncio
import contextlib
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlencode

from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


async def bank_page(browser, origin, flow, rail, screen):
    page = await browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=1, reduced_motion="reduce")
    query = urlencode({"capture": "1", "embedded": "1", "flow": flow,
                       "screen": screen, "rail": rail})
    await page.goto(origin + "/transfi-remittance/legacy.html?" + query)
    await expect(page.locator(".phone.tf-phone > .head .h1")).to_have_text(
        ("Пополнение " if flow == "in" else "Вывод ") + rail
    )
    assert await page.locator(".phone.tf-phone .tf-head-action").count() == 2, "Missing right header icons"
    assert await page.locator(".tf-scroll select:visible").count() == 0, "Native select leaked into bank UI"
    return page


async def assert_mobile_header(page):
    metrics=await page.locator(".phone.tf-phone:not(.is-home) > .head").evaluate(
        """el => ({
            paddingTop:parseFloat(getComputedStyle(el).paddingTop),
            safeArea:CSS.supports('padding-top','env(safe-area-inset-top)'),
            height:el.getBoundingClientRect().height
        })"""
    )
    assert metrics["paddingTop"] == 14, "Bank header must share the native mobile 14px inset: "+str(metrics)


async def assert_currency_icon(page, selector, currency):
    values=await page.locator(selector).evaluate("""(field) => {
      const glyph=field.querySelector('.fi svg.tf-currency-icon');
      const amount=document.querySelector('.tf-amount .fi svg');
      if(!glyph)return {error:'missing currency SVG'};
      const style=getComputedStyle(glyph);
      const gRect=glyph.getBoundingClientRect();
      const plate=field.querySelector('.fi').getBoundingClientRect();
      return {
        code:glyph.dataset.currency,
        width:gRect.width,height:gRect.height,
        viewBox:glyph.getAttribute('viewBox'),stroke:style.strokeWidth,
        linecap:style.strokeLinecap,linejoin:style.strokeLinejoin,
        plate:plate.width,
        amountWidth:amount&&amount.getBoundingClientRect().width,
        amountStroke:amount&&getComputedStyle(amount).strokeWidth
      };
    }""")
    assert values.get("code") == currency, values
    assert values["width"] == 20 and values["height"] == 20, values
    assert values["viewBox"] == "0 0 24 24", values
    assert values["stroke"] == "1.8px", values
    assert values["linecap"] == "round" and values["linejoin"] == "round", values
    assert values["plate"] == 40, values
    if values["amountWidth"] is not None:
        assert values["amountWidth"] == values["width"], values
        assert values["amountStroke"] == values["stroke"], values


async def assert_native_picker(page, country=False):
    """Verify the bank sheet matches the native USDT network picker markup/stack."""
    sheet=page.locator(".tf-picker-sheet")
    await expect(sheet).to_be_visible()
    geometry=await page.evaluate("""() => {
      const root=document.querySelector('#pickerLayer');
      const dim=root.querySelector('.tf-picker-dim');
      const sheet=root.querySelector('.tf-picker-sheet');
      const box=sheet.querySelector('.tf-picker-box');
      const row=box.querySelector('.tf-picker-row');
      const radio=row.querySelector('.rd');
      const sr=sheet.getBoundingClientRect(), br=box.getBoundingClientRect();
      const hit=document.elementFromPoint(sr.left+sr.width/2,sr.top+Math.min(64,sr.height/2));
      return {
        overlay:root.classList.contains('view')&&root.classList.contains('ovl'),
        dimZ:Number(getComputedStyle(dim).zIndex),
        sheetZ:Number(getComputedStyle(sheet).zIndex),
        dimOpacity:parseFloat(getComputedStyle(dim).opacity),
        sheetOnTop:sheet===hit||sheet.contains(hit),
        boxCount:sheet.querySelectorAll('.box').length,
        rowCount:box.querySelectorAll('.row').length,
        boxBackground:getComputedStyle(box).backgroundColor,
        rowBackground:getComputedStyle(row).backgroundColor,
        radioWidth:parseFloat(getComputedStyle(radio).width),
        radioHeight:parseFloat(getComputedStyle(radio).height),
        selected:box.querySelectorAll('.rd.on').length,
        oldCards:box.querySelectorAll('.tf-picker-row[style*="border-radius"]').length,
        flags:box.querySelectorAll('.tf-country-flag').length,
        matchingFlags:box.querySelectorAll('.tf-picker-row .ri .tf-country-flag').length,
        textFlags:box.querySelectorAll('.tf-flag-emoji').length,
        rowWidth:row.getBoundingClientRect().width,
        boxWidth:br.width,
        sheetWidth:sr.width,
        checked:box.querySelectorAll('[aria-checked="true"]').length,
        checkGlyphs:[...box.querySelectorAll('.rd')].some(el=>el.textContent.trim().length>0)
      };
    }""")
    assert geometry["overlay"], geometry
    assert geometry["dimZ"] == 4 and geometry["sheetZ"] == 5, geometry
    assert 0.38 <= geometry["dimOpacity"] <= 0.42 and geometry["sheetOnTop"], geometry
    assert geometry["boxCount"] == 1 and geometry["rowCount"] >= 3, geometry
    assert geometry["boxBackground"] != geometry["rowBackground"], geometry
    assert geometry["radioWidth"] == 24 and geometry["radioHeight"] == 24, geometry
    assert geometry["selected"] == 1 and geometry["checked"] == 1, geometry
    assert geometry["oldCards"] == 0 and not geometry["checkGlyphs"], geometry
    assert abs(geometry["rowWidth"] - geometry["boxWidth"]) < 1, geometry
    assert not geometry["textFlags"], geometry
    if country:
        assert geometry["flags"] == geometry["rowCount"], geometry
        assert geometry["matchingFlags"] == geometry["rowCount"], geometry
        assert await page.locator('[data-picker="country"] .tf-country-flag').count() == 1
    else:
        assert geometry["flags"] == 0, geometry


async def assert_rail_method_icons(browser, origin):
    # Preserve existing method-row geometry in deposit and withdrawal sheets.
    for flow in ('in', 'out'):
        page = await browser.new_page(viewport={'width': 430, 'height': 932})
        await page.goto(origin + '/transfi-remittance/legacy.html?capture=1&embedded=1&flow=' + flow + '&screen=home&modal=' + flow)
        sheet = page.locator('#methodLayer .tf-method-sheet')
        await expect(sheet).to_be_visible()
        original_logo = sheet.locator('.tf-method-row .cn img').first
        await expect(original_logo).to_be_visible()
        native = sheet.locator('.tf-method-row .cn:has(img)').first
        native_style = await native.evaluate('el => {const s=getComputedStyle(el);return {size:[s.width,s.height],gray:s.backgroundColor}}')
        old_size = await original_logo.evaluate('el => {const s=getComputedStyle(el);return [s.width,s.height]}')
        assert old_size == ['24px', '24px'], old_size
        symbols = {}
        for rail in ('SEPA', 'SWIFT'):
            row = sheet.locator('.tf-method-row').filter(has_text=rail)
            assert await row.count() == 1, (flow, rail)
            icon = row.locator('.cn.tf-rail-icon[data-rail-icon="' + rail + '"]')
            await expect(icon).to_be_visible()
            metrics = await icon.evaluate("""el => {
              const badge=el.querySelector('.tf-rail-mark'),glyph=badge?.querySelector('svg.tf-rail-glyph');
              if(!badge||!glyph)return {missing:true};
              const p=el.getBoundingClientRect(),b=badge.getBoundingClientRect(),
                g=glyph.getBoundingClientRect(),ps=getComputedStyle(el),
                bs=getComputedStyle(badge),gs=getComputedStyle(glyph);
              return {plate:[ps.width,ps.height],badge:[bs.width,bs.height],
                glyph:[gs.width,gs.height],gray:ps.backgroundColor,purple:bs.backgroundColor,
                ink:bs.color,centered:Math.max(Math.abs(p.x+p.width/2-b.x-b.width/2),
                  Math.abs(p.y+p.height/2-b.y-b.height/2),
                  Math.abs(b.x+b.width/2-g.x-g.width/2),
                  Math.abs(b.y+b.height/2-g.y-g.height/2))<0.6,artwork:glyph.innerHTML};
            }""")
            assert metrics['plate']==native_style['size'] and metrics['gray']==native_style['gray'], metrics
            assert metrics['badge']==old_size and metrics['glyph']==['16px','16px'], metrics
            assert metrics['purple']=='rgb(111, 75, 242)' and metrics['ink']=='rgb(255, 255, 255)', metrics
            assert metrics['centered'], metrics
            symbols[rail] = metrics['artwork']
        assert symbols['SEPA'] != symbols['SWIFT'], 'Method icons must differ by symbol'
        await page.close()

async def smoke(browser, origin):
    await assert_rail_method_icons(browser, origin)
    for rail in ("SEPA", "SWIFT"):
        page = await bank_page(browser, origin, "in", rail, "in-details")
        await assert_mobile_header(page)
        if rail == "SEPA":
            assert await page.locator('[data-picker="inCurrency"]').count() == 0, "SEPA EUR must be fixed"
            assert "EUR" in await page.locator(".tf-deposit-currency").inner_text()
            await assert_currency_icon(page,".tf-deposit-currency","EUR")
        else:
            await page.locator('[data-picker="inCurrency"]').click()
            sheet = page.locator(".tf-picker-sheet")
            await expect(sheet).to_be_visible()
            await assert_native_picker(page)
            await page.locator('[data-picker-value="USD"]').click()
            await expect(sheet).to_have_count(0)
            assert "USD" in await page.locator('[data-picker="inCurrency"]').inner_text()
            assert "DEMOUS00" in await page.locator(".tf-requisites").inner_text()
            # The selected USD currency glyph must use the same vector metric.
            usd=page.locator('[data-picker="inCurrency"] svg.tf-currency-icon')
            await expect(usd).to_have_attribute('data-currency','USD')
            await page.locator('[data-picker="inCurrency"]').click()
            await page.keyboard.press("Escape")
            await expect(page.locator(".tf-picker-sheet")).to_have_count(0)
        await page.close()

        page = await bank_page(browser, origin, "out", rail, "out-config")
        await assert_mobile_header(page)
        source=page.locator(".tf-source")
        await expect(source).to_have_count(1)
        assert await source.locator(".addon").count() == 0, "Unexpected USD right suffix"
        assert await source.locator(".fl b").inner_text() == "Доступно 4 812.60 $"
        assert await source.locator(".fi img").count() == 1
        assert await page.locator(".tf-amount .fi svg").count() == 1
        if rail=="SEPA":
            await assert_currency_icon(page,".tf-fixed-currency","EUR")
        else:
            await assert_currency_icon(page,'[data-picker="outCurrency"]',"EUR")
        if rail == "SEPA":
            assert await page.locator('[data-picker="outCurrency"]').count() == 0, "SEPA EUR must be fixed"
        else:
            await page.locator('[data-picker="outCurrency"]').click()
            await expect(page.locator(".tf-picker-sheet")).to_be_visible()
            await assert_native_picker(page)
            await page.locator('[data-picker-value="GBP"]').click()
            assert "GBP" in await page.locator('[data-picker="outCurrency"]').inner_text()
            await assert_currency_icon(page,'[data-picker="outCurrency"]',"GBP")
        await page.locator('[data-picker="country"]').click()
        await assert_native_picker(page, country=True)
        # Row must be clickable without force, with the dim BEHIND the sheet.
        await page.locator('[data-picker-value="FR"]').click()
        assert "Франция" in await page.locator('[data-picker="country"]').inner_text()
        await page.locator('[data-picker="country"]').click()
        await assert_native_picker(page, country=True)
        await page.locator('[data-picker-value="DE"]').click()
        assert "Германия" in await page.locator('[data-picker="country"]').inner_text()
        await page.close()

        page = await bank_page(browser, origin, "out", rail, "out-recipient")
        # No decorative field icons on the recipient step — including purpose
        # and the optional SWIFT/SEPA fields in the standalone disclosure.
        field_count=3 if rail=="SEPA" else 5
        assert await page.locator('#content > .tf-recipient-field').count()==field_count, "Unexpected number of top-level recipient fields"
        assert await page.locator('#f-firstName').count()==0
        assert await page.locator('#f-lastName').count()==0
        name=page.locator('#f-recipientName')
        await expect(name).to_be_visible()
        assert 'Имя и фамилия получателя' in await page.locator('#wrap-recipientName').inner_text()
        cta=page.locator('.tf-foot .btn')
        await expect(cta).to_have_attribute('aria-disabled','true')
        assert await cta.get_attribute('disabled') is None, "Inactive CTA must remain clickable"
        await cta.evaluate('(el) => el.click()')
        await expect(page.locator('.tf-submit-error')).to_contain_text('имя и фамилию получателя')
        await name.fill('Иван')
        await expect(cta).to_have_attribute('aria-disabled','true')
        await cta.evaluate('(el) => el.click()')
        await expect(page.locator('.tf-submit-error')).to_contain_text('полностью')
        await name.fill('Иван Иванов')
        await expect(cta).to_have_attribute('aria-disabled','true')
        await cta.evaluate('(el) => el.click()')
        missing='IBAN' if rail=='SEPA' else 'номер счёта'
        await expect(page.locator('.tf-submit-error')).to_contain_text(missing)
        assert await page.locator('#content .tf-recipient-field .fi').count()==0
        assert await page.locator('#content [data-picker="purpose"] .fi').count()==0
        details=page.locator('#content details.tf-recipient-extra')
        await expect(details).to_have_count(1)
        assert await details.evaluate("""el => {
          const content=document.querySelector('#content');
          return content.lastElementChild===el && getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'
            && getComputedStyle(el).paddingLeft==='0px'
            && getComputedStyle(el).borderTopWidth==='0px';
        }"""),"Optional details must be the last standalone header with no card wrapper"
        assert not await details.get_attribute("open"), "Additional bank fields must initially be collapsed"
        await details.locator("summary").click()
        await expect(details).to_have_attribute("open","")
        expected_optional=2 if rail=="SEPA" else 4
        assert await details.locator(".tf-recipient-field").count()==expected_optional
        assert await details.locator(".fi").count()==0
        for caption in await details.locator('.fld .fl i').all_inner_texts():
            assert 'необязательно' not in caption, 'Optional qualifier should not appear in expanded labels'
        assert await details.locator('.fld.tf-field').first.evaluate(
            "el=>getComputedStyle(el).backgroundColor==='rgb(255, 255, 255)'"
        ),"Expanded fields should be individually white without an outer card"
        optional=details.locator('input').first
        await optional.fill("DEMO_OPTIONAL")
        await details.locator("summary").click()
        await expect(details).not_to_have_attribute("open","")
        await details.locator("summary").click()
        await expect(optional).to_have_value("DEMO_OPTIONAL")
        await page.locator('[data-picker="purpose"]').click()
        await expect(page.locator(".tf-picker-sheet")).to_be_visible()
        await assert_native_picker(page)
        await page.locator('[data-picker-value="other"]').click()
        await expect(page.locator("#wrap-purposeOther")).to_be_visible()
        await expect(page.locator('.tf-foot .btn')).to_have_attribute('aria-disabled','true')
        await page.locator('#f-purposeOther').fill('Оплата обучения')
        if rail=='SEPA':
            await page.locator('#f-iban').fill('DE00 0000 0000 0000 0000 00')
        else:
            await page.locator('#f-account').fill('000000000000')
            await page.locator('#f-bic').fill('DEMOXXXX')
            await page.locator('#f-bank').fill('Банк получателя')
        await expect(page.locator('.tf-foot .btn')).to_have_attribute('aria-disabled','false')
        await page.locator('.tf-foot .btn').click()
        await expect(page.locator('.tf-review-box')).to_be_visible()
        assert 'Иван Иванов' in await page.locator('.tf-review-box').inner_text()
        await page.locator('.phone.tf-phone > .head .back').click()
        await expect(page.locator('#f-recipientName')).to_have_value('Иван Иванов')

        await page.close()

    # Config CTA must look disabled when amount is empty, but explain why on click.
    for rail in ('SEPA','SWIFT'):
        page=await bank_page(browser,origin,'out',rail,'out-config')
        cta=page.locator('.tf-foot .btn')
        await expect(cta).to_have_attribute('aria-disabled','true')
        assert await cta.get_attribute('disabled') is None
        await cta.evaluate('(el) => el.click()')
        await expect(page.locator('.tf-submit-error')).to_contain_text('сумму перевода')
        await page.locator('#tf-out-amount').fill('1')
        await expect(cta).to_have_attribute('aria-disabled','true')
        await cta.evaluate('(el) => el.click()')
        await expect(page.locator('.tf-submit-error')).to_contain_text('комиссии')
        await page.locator('#tf-out-amount').fill('5000')
        await expect(cta).to_have_attribute('aria-disabled','true')
        await cta.evaluate('(el) => el.click()')
        await expect(page.locator('.tf-submit-error')).to_contain_text('Недостаточно средств')
        await page.locator('#tf-out-amount').fill('100')
        await expect(cta).to_have_attribute('aria-disabled','false')
        await cta.click()
        await expect(page.locator('#f-recipientName')).to_be_visible()
        await page.close()

    # The original wallet uses 14px top padding on 390px and 430px viewports.
    narrow=await browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1)
    await narrow.goto(origin+"/transfi-remittance/legacy.html?capture=1&embedded=1&flow=out&screen=out-config&rail=SEPA")
    await assert_mobile_header(narrow)
    await narrow.close()

    # The ONE canonical picker block exposes only standalone fields.
    # The original bank handlers are reused for country/currency; the
    # source USDT net-pick/ns-sheet primitives are interactive for network.
    catalog=await browser.new_page(viewport={"width":1440,"height":900})
    await catalog.goto(origin+"/ui-kit/")
    group=catalog.locator("#selectors.cmp")
    await expect(group).to_have_count(1)
    assert await catalog.locator('article.cmp#netsheet,article.cmp#bankpicker').count()==0
    assert await group.locator("figure.v").count()==3
    await group.scroll_into_view_if_needed()

    # SEPA/SWIFT glyphs are catalogued alongside original wallet coins.
    coins=catalog.frame_locator('#coins iframe[src*="coins.html#light"]')
    for rail in ("SEPA","SWIFT"):
        plate=coins.locator('[data-rail-icon="'+rail+'"]')
        await expect(plate).to_be_visible()
        dims=await plate.evaluate("""el => ({
           plate:el.getBoundingClientRect().width,
           badge:el.querySelector('.tf-rail-mark').getBoundingClientRect().width,
           glyph:el.querySelector('.tf-rail-glyph').getBoundingClientRect().width
        })""")
        assert dims=={"plate":40,"badge":24,"glyph":16},(rail,dims)

    network=catalog.frame_locator('#selectors iframe[src*="netsheet.html"]')
    await expect(network.locator('#network-trigger')).to_be_visible(timeout=15000)
    # All three component specimens are already OPEN at initial paint.
    await expect(network.locator('.ns-layer .ns-sheet')).to_be_visible()
    assert 'settled' in await network.locator('.ns-sheet').get_attribute('class')
    assert 'settled' in await network.locator('.ns-layer .dim').get_attribute('class')
    assert await network.locator('header,.head,.tf-source,.tf-quote').count()==0
    assert await network.locator('.ns-box .row').count()==4
    assert await network.locator('.ns-box .rd.on').count()==1
    await network.locator('[data-ns="bnb"]').click()
    await expect(network.locator('#network-value')).to_have_text("BEP-20")
    await expect(network.locator('.ns-layer')).to_be_hidden()
    before=await network.locator('#network-trigger').evaluate(
        'el => el.getBoundingClientRect().toJSON()'
    )
    await network.locator('#network-trigger').click()
    await expect(network.locator('[data-ns="bnb"]')).to_have_attribute("aria-checked","true")
    sheet_motion=await network.locator('.ns-sheet').evaluate("""el => ({
        name:getComputedStyle(el).animationName,
        duration:getComputedStyle(el).animationDuration,
        easing:getComputedStyle(el).animationTimingFunction
    })""")
    assert sheet_motion['name']=='sheet-in' and sheet_motion['duration']=='0.62s',sheet_motion
    await catalog.wait_for_timeout(700)  # original motion is 620ms
    after=await network.locator('#network-trigger').evaluate(
        'el => el.getBoundingClientRect().toJSON()'
    )
    assert all(abs(before[k]-after[k])<1 for k in ('x','y','width','height')),(
        "Network field moved while sheet animated",before,after
    )
    await network.locator('.ns-layer [data-close]').click(position={"x":8,"y":8})
    await expect(network.locator('.ns-layer')).to_be_hidden()

    for mode,field,new_value,expected in (
       ("country","country","FR","Франция"),
       ("currency","outCurrency","GBP","GBP")
    ):
        outer=catalog.frame_locator(
          '#selectors iframe[src*="mode='+mode+'"]'
        )
        inner=outer.frame_locator('iframe.canonical-embed')
        picker=inner.locator('[data-picker="'+field+'"]')
        await expect(picker).to_be_visible(timeout=15000)
        assert await inner.locator('#content > .fld').count()==1
        assert await inner.locator('#content .tf-quote, #content .tf-source').count()==0
        assert await inner.locator('.phone.tf-phone > .head').is_hidden()
        # Source-backed currency/country specimens begin fully expanded.
        await expect(inner.locator('.tf-picker-sheet')).to_be_visible()
        assert await picker.get_attribute('aria-haspopup')=="dialog"
        assert 'settled' in await inner.locator('.tf-picker-sheet').get_attribute('class')
        assert 'settled' in await inner.locator('.tf-picker-dim').get_attribute('class')
        assert await inner.locator('.tf-picker-sheet').evaluate(
          'el => getComputedStyle(el).animationName'
        )=='none'
        await expect(inner.locator('.tf-picker-sheet .sh2')).to_have_text(
            "Страна" if mode=="country" else "Валюта"
        )
        assert await inner.locator('.tf-picker-box').count()==1
        assert await inner.locator('.tf-picker-row .rd.on').count()==1
        if mode=="country":
            assert await inner.locator('.tf-picker-row .tf-country-flag').count()>=4
        else:
            assert await inner.locator('.tf-picker-row .tf-currency-icon').count()==3
        z=await inner.locator('.tf-picker-layer').evaluate("""root => ({
          sheet:Number(getComputedStyle(root.querySelector('.tf-picker-sheet')).zIndex),
          dim:Number(getComputedStyle(root.querySelector('.tf-picker-dim')).zIndex)
        })""")
        assert z["sheet"]>z["dim"],z
        await inner.locator('[data-picker-value="'+new_value+'"]').click()
        await expect(inner.locator('.tf-picker-layer')).to_be_hidden()
        assert expected in await picker.inner_text()
        bounds_before=await picker.evaluate('el => el.getBoundingClientRect().toJSON()')
        await picker.click()
        await expect(inner.locator('.tf-picker-sheet')).to_be_visible()
        await expect(inner.locator('[data-picker-value="'+new_value+'"]')).to_have_attribute("aria-checked","true")
        motion=await inner.locator('.tf-picker-sheet').evaluate("""el => ({
          name:getComputedStyle(el).animationName,
          duration:getComputedStyle(el).animationDuration
        })""")
        assert motion=={'name':'sheet-in','duration':'0.62s'},motion
        await catalog.wait_for_timeout(700)  # original motion is 620ms
        bounds_after=await picker.evaluate('el => el.getBoundingClientRect().toJSON()')
        assert all(abs(bounds_before[k]-bounds_after[k])<1 for k in
                   ('x','y','width','height')),(
            "Underlying country/currency trigger jumped during sheet-in",
            mode,bounds_before,bounds_after
        )
        await inner.locator('[data-picker-dismiss]').click(position={"x":8,"y":8})
        await expect(inner.locator('.tf-picker-layer')).to_be_hidden()
    # Canonical source-account/currency specimens embed live bank fields.
    fields=catalog.locator("#bankfields")
    await expect(fields).to_have_count(1)
    await fields.scroll_into_view_if_needed()
    for mode,rail,code in (("sepa","SEPA","EUR"),("swift","SWIFT","EUR")):
        outer=catalog.frame_locator('#bankfields iframe[src*="mode='+mode+'"]')
        inner=outer.frame_locator("iframe.bank-field-sample")
        await expect(inner.locator(".tf-source")).to_be_visible(timeout=15000)
        assert await inner.locator(".tf-source .addon").count()==0
        assert await inner.locator(".tf-source .fl b").inner_text()=="Доступно 4 812.60 $"
        currency=(inner.locator(".tf-fixed-currency") if rail=="SEPA"
                  else inner.locator('[data-picker="outCurrency"]'))
        await expect(currency.locator("svg.tf-currency-icon")).to_have_attribute("data-currency",code)
        assert await inner.locator(".tf-currency-icon").count()>=1
        head=inner.locator(".phone.tf-phone:not(.is-home) > .head")
        padding=await head.evaluate("el => parseFloat(getComputedStyle(el).paddingTop)")
        assert padding==14,"Catalog bank header inset: "+str(padding)
    await catalog.close()

    # Test actual embedded exit, not just a standalone legacy.html page.
    page = await browser.new_page(viewport={"width": 430, "height": 932})
    await page.goto(origin + "/transfi-remittance/?flow=in&rail=SWIFT")
    # Direct links must now show the first-use provider confirmation gate.
    await expect(page.locator("#tfv-page")).to_be_visible(timeout=15000)
    await page.evaluate("() => {tfVerificationQA.setScenarioStatus('approved');tfOpenBank('SWIFT','in')}")
    iframe = page.locator("#tf-bank-overlay iframe")
    await expect(iframe).to_be_visible(timeout=30000)
    child = page.frame_locator("#tf-bank-overlay iframe")
    await expect(child.locator(".tf-picker-trigger[data-picker='inCurrency']")).to_be_visible()
    await child.locator(".phone.tf-phone > .head .back").click()
    await expect(page.locator("#tf-bank-overlay")).to_be_hidden()
    assert await page.locator(".view.on .sheet:not([hidden])").count() == 0, "Old sheet left behind"
    await page.close()


async def assert_bank_review_and_status(browser,origin):
    """Compare bank review to P2P .row.tot and outcomes to source SBP/P2P screens."""
    for rail,fee in (("SEPA",2.50),("SWIFT",18.00)):
        page=await bank_page(browser,origin,"out",rail,"out-recipient")
        await page.evaluate("""() => {
          S.amount='100';
          S.recipientName='Иван Иванов';
          S.iban='DE00 0000 0000 0000 0000 00';
          S.account='000000000000';S.bic='DEMOXXXX';
          S.bank='Банк получателя';S.purpose='personal';
          go('out-review');
        }""")
        await expect(page.locator("#phoneTitle")).to_have_text("Проверьте перевод")
        assert await page.locator('.tf-scroll .gt').count()==0
        assert await page.locator(".tf-review-box .rt").all_inner_texts()==[
            "Метод","Кому","Страна","Счёт","Назначение"
        ]
        assert "Иван Иванов" in await page.locator(".tf-review-box").inner_text()
        # The recipient/details card MUST inherit the same canonical
        # left-label / right-value typography as the calculation card.
        styles=await page.evaluate("""() => {
          const selectors=['.tf-review-box .row:first-child',
                           '.tf-review-quote .row:first-child'];
          return selectors.map(sel => {
            const row=document.querySelector(sel);
            return ['rt','rv'].map(cls => {
              const node=row.querySelector('.'+cls), css=getComputedStyle(node);
              return Object.fromEntries([
                'fontFamily','fontSize','fontWeight','lineHeight','color',
                'textAlign','flexGrow','flexShrink','flexBasis','maxWidth',
                'overflowWrap','whiteSpace'].map(key=>[key,css[key]]));
            });
          });
        }""")
        assert styles[0]==styles[1], (
            "Upper recipient card must match lower calculation card in both columns: "+str(styles)
        )
        assert styles[0][0]['fontWeight']=="500" and styles[0][1]['fontWeight']=="400",styles
        assert styles[0][0]['color']!=styles[0][1]['color'],styles
        rows=page.locator(".tf-review-quote .row")
        assert await rows.locator(".rt").all_inner_texts()==[
            "Сумма перевода","Курс","Комиссия","Спишется со счёта"
        ]
        assert await rows.nth(0).locator(".rv").inner_text()=="92,59 EUR"
        assert await rows.nth(1).locator(".rv").inner_text()=="1 $ ≈ 0.9259 EUR"
        assert await rows.nth(2).locator(".rv").inner_text()==f"{fee:,.2f}".replace(",", " ").replace(".", ",")+" $"
        expected_total=100+fee
        assert await rows.nth(3).locator(".rv").inner_text()==f"{expected_total:.2f}".replace(".", ",")+" $"
        assert "tot" in await rows.last.get_attribute("class")
        assert "USD" not in await page.locator(".tf-review-quote").inner_text()
        await expect(page.locator(".tf-foot .btn")).to_have_text("Перевести 92,59 EUR")
        await page.locator(".tf-foot .btn").click()
        assert await page.evaluate("() => S.screen")=="out-progress"
        await expect(page.locator(".tf-bank-wait .ring")).to_be_visible()
        await expect(page.locator(".tf-bank-wait .h2")).to_have_text("Перевод обрабатывается")
        assert await page.locator(".timeline, .track, .tf-scroll .tbl").count()==0
        await page.evaluate("() => uxBankCallback('success')")
        assert await page.evaluate("() => S.screen")=="out-success"
        await expect(page.locator(".tf-bank-result .okc")).to_be_visible()
        await expect(page.locator(".tf-bank-result .h2")).to_have_text("Перевели 92,59 EUR")
        assert "Иван Иванов" in await page.locator(".tf-bank-result .p").inner_text()
        assert await page.locator(".tf-bank-final > .head").is_hidden()
        assert await page.locator(".tf-foot .btn").inner_text()=="На главную"
        assert await page.locator(".tf-foot .btno").inner_text()=="Показать операцию"
        await page.evaluate("() => {go('out-progress');uxBankCallback('failed')}")
        await expect(page.locator(".tf-bank-result .sbp-ic")).to_be_visible()
        await expect(page.locator(".tf-bank-result .h2")).to_have_text("Перевод не выполнен")
        assert await page.locator(".timeline").count()==0
        await page.evaluate("() => {go('out-progress');uxBankCallback('held')}")
        await expect(page.locator(".tf-bank-wait .h2")).to_have_text("Перевод на проверке")
        assert await page.locator(".timeline").count()==0
        await page.close()


async def assert_bank_history_bridge(browser,origin):
    """Full user journey: SEPA from wallet to native operation details via callback."""
    page=await browser.new_page(viewport={"width":430,"height":932})
    errors=[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    await page.goto(origin+"/transfi-remittance/?qa=1&flow=out&rail=SEPA")
    await page.wait_for_function("() => !!window.tfVerificationQA")
    # This regression is about the bank operation bridge, not first-use email verification.
    await page.evaluate("() => {tfVerificationQA.setScenarioStatus('approved');tfOpenBank('SEPA','out')}")
    await expect(page.locator("#tf-bank-overlay iframe")).to_be_visible(timeout=30000)
    child=page.frame_locator("#tf-bank-overlay iframe")
    await expect(child.locator("#tf-out-amount")).to_be_visible(timeout=15000)
    await child.locator("#tf-out-amount").fill("100")
    await child.locator(".tf-foot .btn").click()
    await child.locator("#f-recipientName").fill("Иван Иванов")
    await child.locator("#f-iban").fill("DE00 0000 0000 0000 0000 00")
    await child.locator(".tf-foot .btn").click()
    await expect(child.locator("#phoneTitle")).to_have_text("Проверьте перевод")
    await child.locator(".tf-foot .btn").click()
    await expect(child.locator(".tf-bank-wait")).to_be_visible()
    await page.wait_for_function("""() => PV.data['/operations'].operations.some(
       x=>String(x.id).startsWith('tf-bank-')&&x.status==='queued')""",timeout=10000)
    # The original wallet callback is preserved inside the desktop-only Events tab.
    # On mobile, trigger the same DOM handler without revealing tester controls.
    await page.evaluate("() => document.getElementById('pv-bank-ok').click()")
    await expect(child.locator(".tf-bank-result .h2")).to_have_text("Перевели 92,59 EUR")
    await page.wait_for_function("""() => PV.data['/operations'].operations.some(
       x=>String(x.id).startsWith('tf-bank-')&&x.status==='confirmed')""",timeout=10000)
    await child.locator(".tf-foot .btno").click()
    await expect(page.locator("#tf-bank-overlay")).to_be_hidden()
    await expect(page.locator("#v-details.on")).to_be_visible()
    native=await page.locator("#d-amt").inner_text()
    op=await page.evaluate("""() => PV.data['/operations'].operations.find(
      x=>String(x.id).startsWith('tf-bank-'))""")
    assert op and op['amount_minor']==-10250 and op['status']=='confirmed',op
    assert native.strip() and '102' in native, "Native ALT.VU amount rendering: "+native
    assert not errors, "Bank iframe JS errors: "+" | ".join(errors)
    await page.close()


async def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = "http://127.0.0.1:" + str(server.server_port)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
            try:
                await smoke(browser, origin)
                await assert_bank_review_and_status(browser,origin)
                await assert_bank_history_bridge(browser,origin)
            finally:
                await browser.close()
        print("PASS: bank selectors, original P2P review totals, SBP wait/result, callback and native operation details")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    asyncio.run(main())

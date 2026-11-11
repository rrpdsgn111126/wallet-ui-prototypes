#!/usr/bin/env python3
"""Снимает разметку компонентов с живой сборки кошелька alt.vu.

Ничего не сочиняет: открывает собранную страницу ALT.VU-server/www/index.html
в Chromium без окна и берёт куски двумя способами.

  static  — разметка, которая лежит в странице как есть (скрипт выключен,
            чтобы видеть ровно то, что уезжает с сервера);
  dynamic — разметка, которую кошелёк рисует скриптом (строки истории,
            системный баннер, строки книжки, список стран): вызываем те же
            функции страницы (opRow, bookRow, veList…) на выдуманных данных.

Сервер API не нужен: запросы к /api отвечают 401, файлы /assets отдаются
с диска. Результат — build/snippets.json.

    python3 build/harvest.py            # ALT.VU-server рядом на рабочем столе
    ALT_SERVER=/путь python3 build/harvest.py
"""
import asyncio
import json
import mimetypes
import os
import pathlib

from playwright.async_api import async_playwright

HERE = pathlib.Path(__file__).resolve().parent
SERVER = pathlib.Path(os.environ.get("ALT_SERVER", "~/Desktop/ALT.VU-server")).expanduser()
WWW = SERVER / "www"
HOST = "http://alt.local"

# ── что берём из страницы как есть ─────────────────────────────────────────────
# ключ → (селектор, номер совпадения)
STATIC = {
    "hdr": ("#v-home .hdr", 0),
    "head_hist": ("#v-history .head", 0),
    "head_simple": ("#v-vpick .head", 0),
    "acts": ("#v-home .acts", 0),
    "hh": ("#v-home .hh", 0),
    "card_home": ("#v-home .cardrow .card", 0),
    "card_view": ("#v-card .card", 0),
    "cstat": (".cstat", 0),
    "bnr": (".bnr", 0),
    "empty": (".empty", 0),
    "topup_sheet": ("#v-topup .sheet", 0),
    "topup_dim": ("#v-topup .dim", 0),
    "ns_sheet": (".ns-sheet", 0),
    "netpick": (".net-pick", 0),
    "unit": ("#v-out-usdt-tron .unit", 0),
    "fld_name": ("#v-name .fld", 0),
    "fld_avail": ("#v-out-usdt-tron .fld.g", 0),
    "out_wrap": ("#v-out-usdt-tron .wrap", 0),
    "otp": (".otp", 0),
    "lock_sheet": ("#v-lock .sheet", 0),
    "warn": ("#v-dep-usdt-tron .warn", 0),
    "tbl": (".tbl", 0),
    "done_hero": ("#v-done .hero", 0),
    "ring": (".ring", 0),
    "qrbox": ("#v-dep-usdt-tron .qrbox", 0),
    "bnv": (".bnv", 0),
    "ptabs": (".ptabs", 0),
    "lang_box": (".lang-box", 0),
    "steps": (".steps", 0),
    "settings_box": ("#v-settings .box", 0),
    "seg": (".seg", 0),
    "chips": ("#v-filters .chips", 0),
    "agree": (".agree", 0),
    "toast": ("#toast", 0),
    "vpick_search": ("#v-vpick .pick-top", 0),
    "welcome_hero": ("#v-welcome .hero", 0),
    "note": (".wrap > .note:not([hidden])", 0),
    "btn": ("#v-name .btn", 0),
    "btno": ("button.btno", 0),
    "ha_dot": (".ha:has(.dot)", 0),
    "dep_wrap": ("#v-dep-usdt-tron .wrap", 0),
}

# ── что кошелёк рисует скриптом ────────────────────────────────────────────────
# Данные выдуманы. Время — фиксированное, чтобы сборка давала один результат.
DYNAMIC = {
    "history": r"""(() => {
      const t = (h, m) => new Date(Date.UTC(2026, 10, 10, h - 4, m)).toISOString();
      const today = [
        {id:'d1', kind:'deposit', coin:'USDT', network:'tron', amount_minor:150000, status:'credited', created_at:t(14,2)},
        {id:'c1', kind:'card', title:'Uber', mcc:'4121', amount_minor:-1840, status:'credited', created_at:t(12,40), last4:'4821', second:'67.58 AED'},
        {id:'w1', kind:'withdrawal', coin:'USDC', network:'polygon', amount_minor:-50000, status:'confirming', created_at:t(11,15)},
      ];
      const yday = [
        {id:'c2', kind:'card', title:'Amazon Marketplace', mcc:'5311', amount_minor:-8490, status:'rejected', created_at:t(19,8), last4:'4821'},
        {id:'p1', kind:'transfer', title:'Anna K.', amount_minor:2500, status:'credited', created_at:t(9,30)},
      ];
      return '<div class="d">Сегодня</div><div class="grp">' + today.map(opRow).join('') + '</div>'
           + '<div class="d">Вчера</div><div class="grp">' + yday.map(opRow).join('') + '</div>';
    })()""",
    "sbn": r"""'<div class="sbn"><div class="pi">' + SBN_IC.tg + '</div>'
      + '<div class="pt"><b>Подключите Telegram</b><i>Коды и уведомления в Telegram</i></div>'
      + SBN_CHEV + '</div>'""",
    "book": r"""'<div class="box">' + [
        {id:'b1', coin:'USDT', label:'Биржа', address:'TDemoAddr00000000000000000000xY7q', network:'tron'},
        {id:'b2', coin:'USDC', label:'Мой кошелёк', address:'0xDEMO000000000000000000000000000000c0Fe', network:'polygon'},
      ].map(bookRow).join('') + '</div>'""",
    "countries": r"""(() => { vePick = 'cc'; veList('');
       const rows = [...document.querySelectorAll('#ve-list .row')].slice(0, 5).map(r => r.outerHTML);
       return '<div class="box ve-list" id="ve-list">' + rows.join('') + '</div>'; })()""",
    # Код из письма: три цифры введены, курсор на четвёртой — той же
    # функцией, что рисует ввод на экране кода.
    "otp_typing": r"""(() => { otpCells('#otp .cl', '381');
       return document.querySelector('#otp').outerHTML; })()""",
    # Кружки категорий трат — той же функцией, что строку истории:
    # по одному коду MCC на категорию.
    "cats": r"""(() => [['Еда','5812'],['Продукты','5411'],['Транспорт','4121'],['Покупки','5311'],
        ['Развлечения','7832'],['Здоровье','5912'],['Дом','4900'],['Деньги','6011'],['Прочее','0000']]
        .map(([n, m]) => '<div class="ds-cat"><div class="oi">' + catFill(m) + '</div><span>' + n + '</span></div>').join(''))()""",
    "chk_ok": "CHK_OK",
    "chk_no": "CHK_NO",
    # Строки шторки сетей — тем же шаблоном, что в netPickOpen (src/app.py):
    # список сетей кошелёк спрашивает у сервера, здесь цифры выдуманы.
    "nets": r"""(() => {
      const nets = [{key:'tron', min:'10', conf:20}, {key:'bnb', min:'10', conf:15},
                    {key:'polygon', min:'10', conf:128}, {key:'ton', min:'10', conf:1}];
      const cur = 'tron', coin = 'USDT';
      return '<div class="box ns-box">' + nets.map(n => {
        const on = n.key === cur;
        const sub = 'мин. ' + n.min + ' ' + coin + ' · ' + n.conf + ' подтв.';
        return '<div class="row" data-ns="' + esc(n.key) + '">'
             + '<div class="ri">' + netLogo(n.key) + '</div>'
             + '<div class="rt">' + esc(netName(n.key)) + '<i>' + esc(sub) + '</i></div>'
             + '<div class="rd' + (on ? ' on' : '') + '"></div></div>';
      }).join('') + '</div>'; })()""",
}


async def serve(route):
    url = route.request.url
    path = url[len(HOST):].split("?")[0].split("#")[0]
    if path.startswith("/api/"):
        await route.fulfill(status=401, body="{}", content_type="application/json")
        return
    if path in ("", "/"):
        path = "/index.html"
    f = WWW / path.lstrip("/")
    if f.is_dir():
        f = f / "index.html"
    if not f.exists():
        await route.fulfill(status=404, body="")
        return
    ct = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
    await route.fulfill(status=200, body=f.read_bytes(), content_type=ct)


async def main():
    out = {"static": {}, "dynamic": {}, "errors": []}
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # 1) разметка как есть — скрипт выключен
        ctx = await b.new_context(java_script_enabled=False, viewport={"width": 430, "height": 932},
                                  locale="ru-RU", timezone_id="Asia/Dubai")
        await ctx.route(HOST + "/**", serve)
        pg = await ctx.new_page()
        await pg.goto(HOST + "/")
        for key, (sel, n) in STATIC.items():
            els = await pg.query_selector_all(sel)
            if len(els) <= n:
                out["errors"].append(f"static {key}: нет {sel}")
                continue
            out["static"][key] = await els[n].evaluate("e => e.outerHTML")
        await ctx.close()

        # 2) то, что рисует скрипт кошелька
        # Язык и пояс — как у человека в Дубае с русским телефоном: кошелёк
        # берёт язык из браузера, время показывает по поясу устройства.
        ctx = await b.new_context(viewport={"width": 430, "height": 932},
                                  locale="ru-RU", timezone_id="Asia/Dubai")
        await ctx.route(HOST + "/**", serve)
        pg = await ctx.new_page()
        await pg.goto(HOST + "/")
        await pg.wait_for_timeout(1200)
        for key, expr in DYNAMIC.items():
            try:
                out["dynamic"][key] = await pg.evaluate(expr)
            except Exception as e:  # noqa: BLE001
                out["errors"].append(f"dynamic {key}: {str(e)[:200]}")
        # QR пополнения: матрицу считает тот же модуль src/qrcode, что и
        # сервер сборки, рисует — drawQR кошелька. В коде — слово «демо».
        try:
            import sys
            sys.path.insert(0, str(SERVER / "src"))
            import qrcode  # noqa: E402 — модуль из ALT.VU-server/src
            q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
            q.add_data("alt.vu demo"); q.make(fit=True)
            m = q.get_matrix()
            rows = ["".join("1" if c else "0" for c in r) for r in m]
            out["dynamic"]["qr"] = await pg.evaluate(
                """(qr) => { const box = document.querySelector('#v-dep-usdt-tron .qrbox');
                  const host = box.querySelector('.dep-qr'); drawQR(host, qr);
                  return box.outerHTML; }""", {"size": len(rows), "rows": rows})
        except Exception as e:  # noqa: BLE001
            out["errors"].append(f"qr: {str(e)[:200]}")
        # константы, нужные витрине: те же значки, что у кошелька
        for name in ("SBN_CHEV",):
            try:
                out["dynamic"][name] = await pg.evaluate(name)
            except Exception as e:  # noqa: BLE001
                out["errors"].append(f"{name}: {e}")
        await b.close()

    idx = (WWW / "index.html").stat()
    out["source"] = {"www_index_mtime": idx.st_mtime, "www_index_size": idx.st_size}
    (HERE / "snippets.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"static {len(out['static'])}/{len(STATIC)}, dynamic {len(out['dynamic'])}")
    for e in out["errors"]:
        print("!!", e)


if __name__ == "__main__":
    asyncio.run(main())

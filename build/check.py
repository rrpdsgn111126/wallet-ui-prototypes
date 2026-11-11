#!/usr/bin/env python3
"""Проверка витрины и PNG-листы.

Открывает index.html с диска (file://) в Chromium без окна на 1440 и 390
точках и проверяет:
  • ни страница, ни одно окно показа не ездит по ширине;
  • в консоли страницы и окон нет ошибок, все файлы нашлись;
  • каждое окно показа сообщило свою высоту (страница компонента дорисовалась).
Затем снимает листы: sheet/00-tokens.png и по листу на группу компонентов.

    python3 build/check.py            # проверка + листы
    python3 build/check.py --no-png   # только проверка
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()

OVERFLOW_JS = r"""() => {
  const W = document.documentElement.clientWidth, bad = [];
  if (document.documentElement.scrollWidth > W + 1) bad.push('страница шире окна: ' + document.documentElement.scrollWidth + ' > ' + W);
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (el.closest('.ds-screen')) return;           // мини-экран сам режет края
    if (r.left < -0.6 || r.right > W + 0.6) {
      const c = (el.className && el.className.baseVal === undefined ? el.className : el.tagName) || el.tagName;
      bad.push(String(c).slice(0, 40) + ' ' + Math.round(r.left) + '…' + Math.round(r.right) + ' при ' + W);
    }
  });
  return bad.slice(0, 8);
}"""


async def run(png=True):
    problems = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h, label in ((1440, 900, "1440"), (390, 844, "390")):
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if png else 1)
            pg = await ctx.new_page()
            log = []
            pg.on("console", lambda m, log=log: log.append(f"{m.type}: {m.text[:200]}")
                  if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e, log=log: log.append(f"pageerror: {str(e)[:200]}"))
            pg.on("requestfailed", lambda r, log=log: log.append(f"не загрузилось: {r.url[-80:]}"))
            await pg.goto(URL)
            n = await pg.locator("iframe").count()
            try:
                await pg.wait_for_function(
                    "n => document.querySelectorAll('iframe[data-ready]').length >= n", arg=n, timeout=30000)
            except Exception:  # noqa: BLE001
                ready = await pg.locator("iframe[data-ready]").count()
                problems.append(f"[{label}] окна показа дорисовались не все: {ready} из {n}")
            await pg.wait_for_timeout(600)
            bad = await pg.evaluate(OVERFLOW_JS)
            problems += [f"[{label}] {x}" for x in bad]
            for fr in pg.frames[1:]:
                try:
                    fb = await fr.evaluate(OVERFLOW_JS)
                except Exception as e:  # noqa: BLE001
                    fb = [f"нет доступа: {e}"]
                problems += [f"[{label}] {fr.url.split('/')[-1]}: {x}" for x in fb]
            problems += [f"[{label}] {x}" for x in log]
            print(f"{label}: окон показа {n}, замечаний {len(problems)}")

            if png and label == "1440":
                out = ROOT / "sheet"
                out.mkdir(exist_ok=True)
                for old in out.glob("*.png"):
                    old.unlink()
                # оглавление прилипает к верху — на листах его нет
                await pg.add_style_tag(content=".toc{position:static}")
                await pg.wait_for_timeout(300)
                groups = await pg.evaluate("[...document.querySelectorAll('section.grp')].map(s => s.id)")
                hdr = pg.locator("header.top")
                await hdr.screenshot(path=str(out / "00-header.png"))
                # Окна показа за краем экрана браузер не дорисовывает — на листе
                # они выходили пустыми. Поэтому окно браузера на время снимка —
                # ровно с группу, и группа целиком в нём.
                for i, gid in enumerate(groups):
                    name = f"{i + 1:02d}-{gid.replace('g-', '')}.png"
                    loc = pg.locator(f"#{gid}")
                    gh = await loc.evaluate("e => Math.ceil(e.getBoundingClientRect().height)")
                    await pg.set_viewport_size({"width": w, "height": gh + 80})
                    await loc.evaluate("e => e.scrollIntoView({block: 'start'})")
                    await pg.wait_for_timeout(700)
                    await loc.screenshot(path=str(out / name))
                    print("  лист", name)
                await pg.set_viewport_size({"width": w, "height": h})
            await ctx.close()
        await b.close()
    return problems


if __name__ == "__main__":
    probs = asyncio.run(run(png="--no-png" not in sys.argv))
    for x in probs:
        print("!!", x)
    print("замечаний нет" if not probs else f"замечаний: {len(probs)}")
    sys.exit(1 if probs else 0)

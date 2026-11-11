#!/usr/bin/env python3
"""Сборка репозитория компонент alt.vu из живой сборки кошелька.

Читает (и только читает) ~/Desktop/ALT.VU-server: собранную страницу
www/index.html — её CSS и картинки, и исходники src/ — чтобы подписать
каждый компонент файлом и строкой, откуда он взят. Разметку компонентов
заранее снимает build/harvest.py в build/snippets.json.

Пишет рядом с собой:
  css/alt-vu-wallet.css   CSS кошелька как есть (поменяны только пути /assets/)
  assets/                 шрифты Inter, знаки монет и сетей, лица карт
  tokens/tokens.css       цвета обеих тем, шрифт, шаг, радиусы, тени — переменными
  tokens/tokens.json      то же для дизайнера и сборщиков
  components/<id>.html    каждый компонент отдельной страницей со всеми состояниями
  showcase/               стили и скрипт витрины (не продукта) + states.css
  index.html              витрина

    python3 build/harvest.py && python3 build/build.py && python3 build/check.py
"""
import collections
import datetime
import html as H
import json
import os
import pathlib
import re
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
SERVER = pathlib.Path(os.environ.get("ALT_SERVER", "~/Desktop/ALT.VU-server")).expanduser()
WWW = SERVER / "www"
SRC = SERVER / "src"

SN = json.loads((ROOT / "build" / "snippets.json").read_text())
S, D = SN["static"], SN["dynamic"]
WARN = []

# ── 1. CSS живой сборки ─────────────────────────────────────────────────────────
PAGE = (WWW / "index.html").read_text()
CSS = re.search(r"<style>(.*?)</style>", PAGE, re.S).group(1)


def rel_assets(text, prefix):
    """Абсолютные /assets/… → относительные: витрина открывается с диска."""
    text = re.sub(r'url\(/assets/', f"url({prefix}", text)
    text = re.sub(r'(src|href)="/assets/', rf'\1="{prefix}', text)
    return text


def css_rules(css):
    """Плоский список (селектор, тело, @media) — без комментариев и @font-face."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out = []

    def parse(s, media):
        i = 0
        while True:
            j = s.find("{", i)
            if j < 0:
                return
            sel = s[i:j].strip()
            depth, k = 1, j + 1
            while k < len(s) and depth:
                depth += {"{": 1, "}": -1}.get(s[k], 0)
                k += 1
            body = s[j + 1:k - 1]
            if sel.startswith(("@media", "@supports")):
                parse(body, sel)
            elif not sel.startswith("@"):
                out.append((sel, body.strip(), media))
            i = k

    parse(css, None)
    return out


RULES = css_rules(CSS)


def decls(body):
    d = collections.OrderedDict()
    for m in re.finditer(r"(--[\w-]+|[a-z-]+)\s*:\s*([^;]+?)\s*(?:;|$)", body.replace("\n", " ")):
        d[m.group(1)] = m.group(2).strip()
    return d


def prop(selector, name):
    """Последнее значение свойства у точного селектора (вне @media)."""
    val = None
    for sel, body, media in RULES:
        if media:
            continue
        parts = [p.strip() for p in sel.split(",")]
        if selector in parts:
            v = decls(body).get(name)
            if v is not None:
                val = v
    return val


# ── 2. ссылки на исходник ───────────────────────────────────────────────────────
_SRC_CACHE = {}


def _lines(file):
    if file not in _SRC_CACHE:
        _SRC_CACHE[file] = (SRC / file).read_text(errors="replace").splitlines()
    return _SRC_CACHE[file]


# Где искать, если в названном файле строки нет: исходники веба кошелька.
# Android, iOS, админка и лендинг — другие сборки, в них не смотрим.
_WEB = ["alt.py", "app.py", "app_views.py", "screens_card.py", "screens.py", "screens2.py",
        "screens3.py", "screens4.py", "screens5.py", "screens_book.py", "screens_contacts.py",
        "screens_install.py", "screens_p2p.py", "screens_plastic.py", "screens_sbp.py",
        "screens_talk.py", "screens_terms.py", "screens_verify.py", "screens_tg.py",
        "screens_tg_app.py", "screens_tg_lock.py", "screens_tg_reg.py", "verify_intro.py",
        "coins.py", "mcc.py", "accent.py", "menu_layout.py", "duo.py", "pilot_1104.py",
        "statement.py", "icons.py", "card_faces.py"]


def ref(file, needle):
    """«src/файл:строка» первой строки, где встречается needle.

    Сначала в названном файле, потом во всех файлах веба кошелька."""
    for f in [file] + [x for x in _WEB if x != file]:
        if not (SRC / f).exists():
            continue
        for i, line in enumerate(_lines(f), 1):
            # «^» в начале — правило с начала строки, а не упоминание внутри другого
            hit = line.startswith(needle[1:]) if needle.startswith("^") else needle in line
            if hit:
                return f"src/{f}:{i}"
    WARN.append(f"нет в src/: {needle}")
    return f"src/{file}"


# ── 3. правки разметки для состояний ────────────────────────────────────────────
def root_cls(h, *add):
    """Добавить классы корневому элементу куска."""
    def sub(m):
        return m.group(1) + " ".join([m.group(2)] + list(add)) + '"'
    out, n = re.subn(r'^(\s*<[a-z]+[^>]*?class=")([^"]*)"', sub, h, count=1)
    if not n:
        out = re.sub(r"^(\s*<[a-z]+)", rf'\1 class="{" ".join(add)}"', h, count=1)
    return out


def root_attr(h, attr):
    return re.sub(r"^(\s*<[a-z]+)", rf"\1 {attr}", h, count=1)


def unhide(h):
    return h.replace(' hidden=""', "")


def nth_cls(h, tag_cls, n, add):
    """В n-м (с нуля) элементе с классом tag_cls добавить класс add."""
    pat = re.compile(r'class="(' + re.escape(tag_cls) + r'(?:\s[^"]*)?)"')
    ms = list(pat.finditer(h))
    if len(ms) <= n:
        WARN.append(f"nth_cls: нет {tag_cls}[{n}]")
        return h
    m = ms[n]
    return h[:m.start()] + f'class="{m.group(1)} {add}"' + h[m.end():]


def screen(inner, height, extra=""):
    """Мини-экран: шторке, тосту и нижнему меню нужен «экран», к низу
    которого они прижаты. Это рамка витрины, в продукте её нет."""
    return f'<div class="ds-screen{extra}" style="height:{height}px">{inner}</div>'


def home(inner):
    """Часть правил кошелька привязана к главной (#v-home .sbn и др.)."""
    return f'<div id="v-home">{inner}</div>'


# ── 4. компоненты ───────────────────────────────────────────────────────────────
GROUPS = [
    ("base", "Основа"),
    ("frame", "Каркас экрана"),
    ("buttons", "Кнопки"),
    ("fields", "Поля ввода"),
    ("choice", "Выбор"),
    ("sheets", "Шторки и списки"),
    ("marks", "Монеты, сети, категории"),
    ("card", "Карта и баннеры"),
    ("status", "Статусы и сообщения"),
]

C = []


def comp(id, group, title, what, classes, refs, states, html_cls="", note=""):
    C.append(dict(id=id, group=group, title=title, what=what, classes=classes,
                  refs=refs, states=states, html_cls=html_cls, note=note))


# Основа ─────────────────────────────────────────────────────────────────────────
TYPE_SAMPLE = (
    '<div class="h1">Заголовок экрана · .h1</div>'
    '<div class="sh2" style="margin-top:12px">Заголовок шторки · .sh2</div>'
    '<div class="hh"><h2>История · .hh h2</h2><a href="#">Все</a></div>'
    '<div class="cblock" style="margin:12px 0 0">'
    '<div class="cbal">1 284<span class="cnt">.60 $</span></div></div>'
    '<div class="hint" style="margin:2px 0 0">Баланс · .cbal и центы · .cnt</div>'
    '<div class="lead" style="margin-top:12px">Вводный абзац · .lead — пятнадцать '
    'на двадцать один, тише заголовка.</div>'
    '<div class="box" style="margin-top:12px"><div class="row"><div class="rt">Строка в плите · .rt'
    '<i>Подпись под строкой · .rt i</i></div><div class="rv">Значение</div></div></div>'
    '<div class="note">Заметка под плитой · .note — <b>с выделением</b>.</div>'
    '<div class="hint" style="margin-top:0">Подсказка поля · .hint</div>'
    '<div class="fld g addr" style="margin-top:12px"><div class="fl"><i>Адрес — моноширинный</i>'
    '<b>TDemoAddr00000000000000000000xY7q</b></div></div>'
)
comp("type", "base", "Шрифт и кегли",
     "Inter 400/500/600/700, вшит в страницу. Деньги: целая часть крупно, центы и знак "
     "мельче (.cnt). Адрес — моноширинный и целиком, без многоточия.",
     ".h1 .sh2 .hh .cbal .cnt .lead .rt .note .hint .fld.addr",
     [("@font-face, body", ref("alt.py", "@font-face{font-family:Inter;src:url(data:font/woff2;base64,__R__)")),
      (".h1", ref("alt.py", ".h1{font-size:20px")),
      (".cbal .cnt", ref("alt.py", ".cbal .cnt{")),
      (".note .hint", ref("alt.py", ".note{font-size:13px")),
      ("адрес моноширинный", ref("alt.py", ".fld.addr .fl b,.fld.addr .fl textarea{font-family"))],
     [("Шкала", TYPE_SAMPLE)])

# Каркас ─────────────────────────────────────────────────────────────────────────
HDR = S["hdr"].replace('<div class="uav"></div>', '<div class="uav">АК</div>') \
              .replace('<span class="uname"></span>', '<span class="uname">Анна</span>')
HDR_DOT = HDR.replace('data-go="notes">', 'data-go="notes">', 1)
HDR_DOT = re.sub(r'(<div class="ha" data-go="notes">.*?</svg>)', r'\1<div class="dot">2</div>', HDR, count=1, flags=re.S)
comp("hdr", "frame", "Шапка главной",
     "Аватар с инициалами (лайм, знак чёрный), имя, справа колокольчик и чат — круглые "
     "кнопки 40 на стекле. Счётчик непрочитанных садится на край круга.",
     ".hdr .hrow .who .uav .uname .hacts .ha .dot",
     [("разметка", ref("app.py", '<div class="hdr"><div class="hrow">')),
      (".ha", ref("alt.py", ".ha{position:relative;width:40px")),
      (".dot", ref("alt.py", ".dot{position:absolute;top:-3px")),
      (".uav", ref("screens5.py", ".uav{flex:0 0 40px")),
      ("счётчик (скрипт)", ref("app.py", "dot.className = 'dot'"))],
     [("Обычное", HDR), ("Есть непрочитанные", HDR_DOT)])

comp("head", "frame", "Шапка экрана",
     "«Назад» — круг 40 на стекле, заголовок 20/600 в одну строку. Свои кнопки экрана "
     "встают справа, значки — у самого края.",
     ".head .hic .back .h1 .hacts",
     [(".head", ref("alt.py", ".head{position:relative;z-index:1;padding:52px")),
      (".back", ref("alt.py", ".back{flex:0 0 40px")),
      (".head.hic", ref("app.py", ".head.hic .h1{min-width:0")),
      ("разметка «История»", ref("app.py", '<div class="h1">История</div>'))],
     [("Только «назад»", S["head_simple"].replace('<span id="ve-pick-h">Страна</span>', 'Страна')),
      ("С кнопками справа", S["head_hist"])])

BNV = unhide(S["bnv"])
comp("bnv", "frame", "Нижнее меню",
     "Включается брендом (html.menu-bottom). Стеклянная капсула 16 от краёв, пункт 52; "
     "выбранный — серая плашка --n100 и текст плотнее, без обводки.",
     ".bnv .bnv-i .bnv-i.on",
     [("CSS", ref("app.py", "html.menu-bottom .bnv:not([hidden]){")),
      (".bnv-i.on", ref("app.py", ".bnv-i.on{")),
      ("разметка", ref("menu_layout.py", 'class="bnv"'))],
     [("Выбрана «Главная»", screen(nth_cls(BNV, "bnv-i", 0, "on"), 104, " ds-bnv")),
      ("Выбрана «Карта»", screen(nth_cls(BNV, "bnv-i", 2, "on"), 104, " ds-bnv"))],
     html_cls="menu-bottom bnv-on")

comp("ptabs", "frame", "Вкладки профиля",
     "Три раздела профиля. Выбранная — плотнее и с лаймовой чертой снизу.",
     ".ptabs .ptab .ptab.on",
     [(".ptab.on", ref("app.py", ".ptab.on{")),
      ("разметка", ref("app.py", '<div class="ptabs'))],
     [("Выбрана «Партнёрка»", S["ptabs"]),
      ("Выбрана «Данные»", S["ptabs"].replace('class="ptab on"', 'class="ptab"')
       .replace('class="ptab" data-go="profile"', 'class="ptab on" data-go="profile"'))])

# Кнопки ─────────────────────────────────────────────────────────────────────────
BTN = S["btn"]
comp("btn", "buttons", "Главная кнопка",
     "Лайм с чёрным текстом, высота 52, радиус 16, лёгкое свечение. Одна на экран.",
     ".btn  ·  :active  ·  :disabled  ·  .off",
     [(".btn", ref("alt.py", ".btn{background:var(--brand)")),
      (".btn,.btno размеры", ref("alt.py", ".btn,.btno{height:52px")),
      ("нажато", ref("app.py", ".btn:active{")),
      ("выключена", ref("app.py", ".btn:disabled{")),
      ("разметка", ref("app.py", 'class="btn" id="b-name"'))],
     [("Обычное", BTN), ("Нажато", root_cls(BTN, "ds-press")),
      ("Выключено (disabled)", root_attr(BTN, "disabled")), ("Выключено (.off)", root_cls(BTN, "off"))])

BTNO = S["btno"]
comp("btno", "buttons", "Вторая кнопка",
     "Всё, что не главное действие: серая --n100, текст --n850, без тени.",
     ".btno  ·  :active  ·  .off",
     [(".btno", ref("alt.py", ".btno{background:var(--n100)")),
      ("нажато", ref("app.py", "button.btno:active")),
      ("выключена", ref("app.py", ".btn.off,.btno.off")),
      ("разметка «Поделиться»", ref("app.py", 'class="btno dep-share"'))],
     [("Обычное", BTNO), ("Нажато", root_cls(BTNO, "ds-press")), ("Выключено (.off)", root_cls(BTNO, "off"))])

LNK = re.search(r'<a class="lnk".*?</a>', S["lock_sheet"], re.S).group(0)
comp("lnk", "buttons", "Ссылка действия",
     "Зелёная --brand-600, 14/500: «Все», «Не помню ПИН-код», «Изменить».",
     ".lnk  ·  .hh a",
     [(".lnk", ref("alt.py", ".lnk{display:inline-flex")),
      (".hh a", ref("alt.py", ".hh a{")),
      ("разметка", ref("app.py", 'data-act="pin-forgot">'))],
     [("В строке", f'<div style="text-align:center">{LNK}</div>'),
      ("Заголовок раздела", S["hh"])])

comp("acts", "buttons", "Быстрые действия",
     "Круги 55 под подписью 11/500. Главное действие — лаймовый круг, остальные белые.",
     ".acts .act .act.p .c",
     [(".acts", ref("alt.py", ".acts{display:flex")),
      (".act.p", ref("alt.py", ".act.p .c{")),
      ("разметка", ref("app.py", '<div class="act p" data-go="topup">'))],
     [("Обычное", S["acts"])])

# Поля ───────────────────────────────────────────────────────────────────────────
FLD = S["fld_name"]
FLD_V = FLD.replace('placeholder="Имя">', 'placeholder="Имя" value="Анна">')
AVAIL = S["fld_avail"].replace('<b class="wd-avail">—</b>', '<b class="wd-avail">1 284.60 $</b>')
ERR_NOTE = '<div class="err-note">Только буквы — без цифр и знаков</div>'
comp("fld", "fields", "Поле ввода",
     "Белое поле 68 со значком в круге и подписью над значением. Серое — только чтение. "
     "Ошибка — красная рамка 1,5 и строка под полем.",
     ".fld.w .fld.g .fi .fl .addon  ·  .fld.err  ·  .fld.off  ·  .err-note",
     [(".fld", ref("alt.py", ".fld{display:flex;align-items:center;gap:14px;height:68px")),
      (".fld.err", ref("app.py", ".fld.err{")),
      (".fld.off", ref("app.py", ".fld.off{")),
      (".err-note", ref("app.py", ".err-note{")),
      ("разметка «Имя»", ref("app.py", 'autocomplete="given-name"'))],
     [("Пустое", FLD), ("Заполнено", FLD_V), ("Ошибка", root_cls(FLD_V, "err") + ERR_NOTE),
      ("Выключено", root_cls(FLD_V, "off")), ("Только чтение (серое)", AVAIL)])

AMT = re.search(r'(<div class="fld w"><div class="fi">(?:(?!<div class="fld).)*?wd-amt.*?</div></div>)\s*</div>\s*$',
                S["out_wrap"], re.S)
AMT = AMT.group(1) if AMT else ""
if not AMT:
    WARN.append("поле суммы не найдено")
AMT_V = AMT.replace('placeholder="0.00">', 'placeholder="0.00" value="250.00">')
comp("amount", "fields", "Поле суммы",
     "Сумма с валютой и кнопкой MAX справа (.mx — серая капсула).",
     ".fld.w .addon .cur .mx",
     [(".mx", ref("alt.py", ".mx{padding:10px 14px")),
      (".cur", ref("alt.py", ".cur{font-size:16px")),
      ("разметка", ref("app.py", 'class="mx wd-max"'))],
     [("Пустое", AMT), ("Заполнено", AMT_V), ("Ошибка", root_cls(AMT_V, "err")
      + '<div class="err-note">Больше, чем на счёте</div>')])

comp("netpick", "fields", "Поле-выбор",
     "Выглядит полем, открывает шторку: сеть, банк, страна. Знак сети — в серой оправе.",
     ".fld.w.net-pick .nlg .addon",
     [(".fld .addon", ref("alt.py", "^.addon{")),
      (".nlg", ref("alt.py", "^.nlg{")),
      ("разметка", ref("app.py", 'class="fld w net-pick"'))],
     [("Обычное", S["netpick"]), ("Выключено", root_cls(S["netpick"], "off"))])

UNIT = S["unit"]
# высоту поля под адрес ставит скрипт кошелька; здесь то же — две строки
UNIT_V = UNIT.replace('rows="1"', 'rows="2"').replace('spellcheck="false"></textarea>',
                      'spellcheck="false">TDemoAddr00000000000000000000xY7q</textarea>')
comp("unit", "fields", "Поле адреса с инструментами",
     "Поле растёт под адрес целиком (без многоточия), под ним три зоны 56: "
     "вставить · сканировать · из книжки.",
     ".unit .urow .ut .uzones .uzone",
     [(".unit", ref("alt.py", ".unit{background:var(--surface")),
      (".uzone", ref("alt.py", ".uzone{position:relative;flex:1")),
      ("разметка", ref("app_views.py", "acts = ['wd-paste', 'wd-scan', 'wd-book']"))],
     [("Пустое", UNIT), ("С адресом", UNIT_V)])

OTP = S["otp"]
comp("otp", "fields", "Код подтверждения",
     "Шесть ячеек 59×60. Текущая — зелёная рамка, введённые — точками, ошибка — "
     "красные рамки у всех.",
     ".otp .cl  ·  .cl.on  ·  .cl.err",
     [(".otp .cl", ref("alt.py", ".otp .cl{width:59px")),
      (".cl.on", ref("alt.py", ".otp .cl.on{")),
      (".cl.err", ref("app.py", ".cl.err{")),
      ("ввод (скрипт)", ref("app.py", "function otpCells("))],
     [("Пусто, курсор в первой", nth_cls(OTP, "cl", 0, "on")), ("Ввод", D["otp_typing"]),
      ("Ошибка", OTP.replace('class="cl"', 'class="cl err"').replace('<div class="cl err"></div>',
                                                                    '<div class="cl err">•</div>'))])

# Клавишу Face ID скрипт кошелька показывает всегда: снимает hidden и гасит
# классом .off, если биометрии нет (src/app.py, bioKey) — место под ней остаётся.
LOCK_RAW = S["lock_sheet"]
LOCK = LOCK_RAW.replace('class="key q bio" data-act="bio-unlock" hidden=""',
                        'class="key q bio off" data-act="bio-unlock"')
LOCK_BIO = LOCK_RAW.replace('class="key q bio" data-act="bio-unlock" hidden=""',
                            'class="key q bio" data-act="bio-unlock"')
LOCK2 = LOCK_BIO.replace('<div class="pin"></div><div class="pin"></div>',
                     '<div class="pin f"></div><div class="pin f"></div>', 1)
LOCK_P = LOCK2.replace('<div class="key" data-k="5">', '<div class="key ds-press" data-k="5">')
comp("pin", "fields", "ПИН-код и клавиатура",
     "Четыре точки 14 (пустая --n100, введённая --n900) и клавиатура 3×4: клавиша 56, "
     "радиус 16, цифра 24/500. Нажатая — серая.",
     ".pins .pin .pin.f .kb .key .key.q  ·  .key:active",
     [(".pin", ref("alt.py", ".pin{width:14px")),
      (".kb .key", ref("alt.py", ".key{")),
      ("нажата", ref("app.py", ".key:active{")),
      ("клавиша Face ID", ref("app.py", "key.classList.toggle('off', !bioOn")),
      ("разметка «Введите ПИН-код»", ref("app.py", "Введите ПИН-код</div>"))],
     [("Пусто, без биометрии", screen(LOCK, 560)), ("С Face ID: две цифры, нажата «5»", screen(LOCK_P, 560))])

# Выбор ──────────────────────────────────────────────────────────────────────────
SEG = S["seg"]
comp("seg", "choice", "Сегменты",
     "«Одно из двух-трёх»: серая дорожка, выбранный сегмент — белая плашка с лёгкой тенью.",
     ".seg .seg .on",
     [(".seg", ref("alt.py", ".seg{")),
      (".seg .on", ref("screens_card.py", ".seg .on{")),
      ("разметка", ref("screens_card.py", 'data-seg="apple"'))],
     [("Первый выбран", SEG),
      ("Второй выбран", SEG.replace('class="on"', 'class=""', 1).replace('class="" data-seg="google"',
                                                                       'class="on" data-seg="google"'))])

CH = S["chips"]
comp("chips", "choice", "Чипы фильтра",
     "Капсулы 36: белые с тенью. В кошельке выбранный чип лаймовый: главной кнопки на экране "
     "фильтров нет, лайм ей не мешает.",
     ".chips .chip .chip.on",
     [(".chip", ref("alt.py", "^.chip{height")),
      (".chip.on", ref("app.py", ".chip.on{")),
      ("разметка", ref("app.py", '<div class="chip on">Все</div>'))],
     [("Выбран «Все»", CH),
      ("Выбраны «Покупки»", CH.replace('class="chip on"', 'class="chip"', 1)
       .replace('<div class="chip">Покупки', '<div class="chip on">Покупки'))])

SETS = S["settings_box"]
comp("sw", "choice", "Переключатель",
     "Дорожка 48×28: выключен — серый, включён — лайм. Стоит справа в строке плиты.",
     ".sw .sw.on",
     [(".sw", ref("alt.py", ".sw{")),
      (".sw.on", ref("alt.py", ".sw.on{")),
      ("разметка «Настройки»", ref("app.py", 'data-act="push-toggle"'))],
     [("Выключено и включено", nth_cls(SETS, "sw", 1, "on"))])

AGR = S["agree"]
comp("cbx", "choice", "Галочка согласия",
     "Квадрат 22 с радиусом 7: пустой — серая рамка, отмеченный — лайм с чёрной галкой.",
     ".agree .cbx .cbx.on",
     [(".cbx", ref("alt.py", ".cbx{")),
      (".cbx.on", ref("alt.py", ".cbx.on{")),
      ("разметка", ref("app.py", '<div class="cbx" data-cbx="1">'))],
     [("Не отмечено", AGR), ("Отмечено", AGR.replace('class="cbx"', 'class="cbx on"'))])

LANG = S["lang_box"]
LANG_ON = nth_cls(LANG, "rd", 5, "on")
comp("radio", "choice", "Выбор одного из списка",
     "Строки плиты с кругом справа: выбранный — лайм с галочкой. Так выбирают язык, "
     "сеть, часовой пояс.",
     ".box .row .rd .rd.on",
     [(".rd", ref("alt.py", ".rd{")),
      (".lang-box .rd.on", ref("app.py", ".lang-box .rd.on{")),
      ("разметка «Язык»", ref("app.py", "lang-row"))],
     [("Выбран «Русский»", LANG_ON)])

comp("longlist", "choice", "Выбор из длинного списка",
     "Отдельный экран: поиск сверху, плита строк ниже. Страна, код страны, часовой пояс, "
     "регион. Ничего не нашлось — одна строка-ответ.",
     ".pick-top .fld.ve-search .ve-list .row .ve-flag .ve-empty",
     [("экран", ref("screens_verify.py", '"vpick":  dict(key="34-vpick"')),
      ("строки (скрипт)", ref("app.py", "function veList(q)")),
      (".ve-list", ref("app.py", ".ve-list{padding:0}"))],
     [("Список", S["vpick_search"] + '<div style="height:12px"></div>' + D["countries"]),
      ("Ничего не нашлось", S["vpick_search"].replace('placeholder="Поиск по названию">',
                                                      'placeholder="Поиск по названию" value="Атлантида">')
       + '<div style="height:12px"></div><div class="box ve-list"><div class="ve-empty">Ничего не нашлось</div></div>')])

# Шторки и списки ────────────────────────────────────────────────────────────────
TOP = unhide(S["topup_dim"]) + S["topup_sheet"]
comp("sheet", "sheets", "Шторка",
     "Затемнение + шторка снизу: ручка 44×5, заголовок 20/600, строки 64 с радиусом 20. "
     "Выбор способа, банка, «куда вывести» — шторкой, не экраном.",
     ".dim .sheet .grab .sh2 .m .ic .mt  ·  .m.off",
     [(".dim .sheet", ref("app.py", ".sheet{position:absolute;left:0;right:0;bottom:0")),
      (".grab", ref("app.py", ".grab{")),
      (".m", ref("alt.py", ".m{display:flex;align-items:center;gap:14px;height:64px")),
      (".m.off", ref("app.py", ".m.off{")),
      ("разметка «Пополнить»", ref("screens.py", 'TOPUP = hub("Пополнить"'))],
     [("Обычное", screen(TOP, 470)),
      ("Строка выключена", screen(nth_cls(TOP, "m", 2, "off"), 470))])

NS = unhide(S["ns_sheet"]).replace('<div class="box ns-box"></div>', D["nets"]) \
    .replace('<div class="note ns-note"></div>',
             '<div class="note ns-note">Адрес у каждой сети свой. Отправляйте монеты только '
             'в той сети, которая выбрана здесь.</div>')
comp("netsheet", "sheets", "Шторка выбора сети",
     "Строки с знаком сети в оправе, минимумом и подтверждениями. Выбранная — лаймовый "
     "круг с галочкой. Под списком — предупреждение про сеть.",
     ".sheet.ns-sheet .ns-box .row .ri .nlg .rd.on",
     [("шаблон строк", ref("app.py", "async function netPickOpen(")),
      ("разметка шторки", ref("app.py", 'class="sheet ns-sheet"'))],
     [("Выбрана TRC20", screen('<div class="dim"></div>' + NS, 520))])

comp("rows", "sheets", "Строки в плите",
     "Плита 20 без рамки; строка от 60: значок в круге 32, текст, значение, шеврон. "
     "Разделитель — волосок фона.",
     ".box .row .ri .rt .rv  ·  .row.cp:active  ·  .row.dang",
     [(".box", ref("alt.py", ".box{")),
      (".row", ref("alt.py", ".row{display:flex")),
      ("нажата", ref("app.py", ".row.cp:active{")),
      (".row.dang", ref("alt.py", ".row.dang")),
      ("разметка «Настройки»", ref("app.py", "Язык интерфейса</div>"))],
     [("Обычное", SETS),
      ("Нажата строка", nth_cls(SETS, "row", 2, "cp ds-press")),
      ("Опасное действие", '<div class="box"><div class="row dang"><div class="rt">Закрыть счёт</div></div></div>')])

comp("tbl", "sheets", "Таблица «название — значение»",
     "Расчёт и реквизиты: название слева, значение справа плотнее.",
     ".tbl .rl",
     [(".tbl", ref("alt.py", ".tbl{")),
      ("разметка", ref("screens_plastic.py", 'id="c-pl-lost-sum"'))],
     [("Обычное", S["tbl"])])

comp("history", "sheets", "История операций",
     "День — надпись над плитой; строка: знак 40 (монета, категория или наш знак), "
     "название и время, сумма и путь. Пришло — зелёным с «+». В работе — без отметки; "
     "отказ — красным словом и крестиком.",
     ".d .grp .op .oi .chk .ot .oa .bad .in",
     [(".op", ref("alt.py", ".op{position:relative;display:flex")),
      (".chk", ref("alt.py", ".chk{position:absolute")),
      ("строка (скрипт)", ref("app.py", "function opRow(o){")),
      ("день (скрипт)", ref("app.py", "'<div class=\"d\">'+k+'</div><div class=\"grp\">'"))],
     [("Сегодня и вчера", D["history"])])

comp("book", "sheets", "Книжка адресов",
     "Название, адрес коротко (начало…конец), сеть серой капсулой справа.",
     ".ab .ic.cic .t .bdg.n",
     [(".ab", ref("alt.py", ".ab{position:relative")),
      ("строка (скрипт)", ref("app.py", "function bookRow(a){"))],
     [("Две записи", D["book"])])

# Монеты, сети, категории ────────────────────────────────────────────────────────
CNS = re.findall(r'<div class="cn"[^>]*>.*?</div>', S["topup_sheet"] + unhide(S["topup_sheet"]), re.S)
CNS = list(dict.fromkeys(CNS))
ALT_CN = re.search(r'<div class="cn"[^>]*><img class="logo".*?</div>', S["fld_avail"], re.S).group(0)
# .nlg заполняет свою ячейку (в кошельке это .fi 40 или .ri 32); ячейка 40 — витрины
NETS = "".join(f'<div class="ds-cn"><div style="width:40px;height:40px">'
               f'<i class="nlg {n}"></i></div><span>{t}</span></div>'
               for n, t in (("tron", "TRON"), ("bnb", "BNB"), ("polygon", "Polygon"), ("ton", "TON")))
COINS = "".join(f'<div class="ds-cn">{c}<span>{t}</span></div>'
                for c, t in zip([ALT_CN] + CNS, ["alt.vu", "СБП", "USDT", "USDC"]))
CICS = "".join(f'<div class="ds-cn"><div class="oi coin"><div class="cic {c} oicoin"></div></div><span>{c.upper()}</span></div>'
               for c in ("usdt", "usdc"))
BIG = re.search(r'<div style="display:flex;justify-content:center"><div class="cn".*?</div></div>',
                S["welcome_hero"], re.S).group(0)
comp("coins", "marks", "Монеты и сети в оправе",
     "Знак — файлом, 60 % круга-оправы --coin-plate (#e9ecf0 / #232221). Знак alt.vu — "
     "лаймовый круг с чёрной «A». Своих контуров нет.",
     ".cn  ·  .cic.usdt .cic.usdc  ·  .nlg.tron .nlg.bnb .nlg.polygon .nlg.ton",
     [(".cn", ref("alt.py", ".cn{flex:0 0 auto;border-radius:999px;background:var(--coin-plate)")),
      ("оправа в Python", ref("alt.py", "def logo_plate(")),
      (".cic", ref("alt.py", ".cic")),
      (".nlg", ref("alt.py", ".nlg"))],
     [("Монеты и знак, 40", f'<div class="ds-row">{COINS}</div>'),
      ("В строке истории", f'<div class="ds-row">{CICS}</div>'),
      ("Сети", f'<div class="ds-row">{NETS}</div>'),
      ("Крупный, 106", BIG)])

comp("cats", "marks", "Категории трат",
     "Кружок 40 в цвете категории — пара фон/знак своя в каждой теме. Покупка в истории "
     "узнаётся по нему.",
     ".catfill .cat-food … .cat-other",
     [("цвета", ref("alt.py", "--cat-food-bg:#fbeee0")),
      ("тёмные", ref("app.py", "--cat-food-bg:#33261a")),
      ("значок (скрипт)", ref("app.py", "function catFill(mcc){"))],
     [("Девять категорий", f'<div class="ds-row">{D["cats"]}</div>')])

# Карта и баннеры ────────────────────────────────────────────────────────────────
CARD_G = S["card_home"]
CARD_I = S["card_view"].replace('class="card ghost"', 'class="card"') \
    .replace('<div class="cnum"></div>', '<div class="cnum">•••• 4821</div>') \
    .replace('<div class="cexp"></div>', '<div class="cexp">09/29</div>')


def faced(k):
    return CARD_I.replace('class="card"', f'class="card fk-{k}"', 1)


comp("card", "card", "Лицо карты",
     "Анодированный лайм — картинкой, одинаковой в обеих темах; надписи внутри всегда "
     "тёмные. До выпуска — та же обложка без Visa и номера, с плюсом выпуска.",
     ".card .ghost .ctop .cblock .ccap .cbal .cbot .cnum .cexp  ·  .fk-online .fk-plastic .fk-frozen",
     [(".card", ref("alt.py", ".card{position:relative;width:398px")),
      (".card.ghost", ref("alt.py", ".card.ghost{color:var(--n850)")),
      ("виды лиц", ref("alt.py", ".card.fk-online{")),
      ("в тёмной теме", ref("app.py", "html.dark .card{")),
      ("разметка", ref("screens_card.py", "def card(frozen=False"))],
     [("Не выпущена", home(CARD_G.replace('<div class="cbal">—</div>',
                                          '<div class="cbal">1 284<span class="cnt">.60 $</span></div>'))),
      ("Выпущена — экран «Карта»", CARD_I), ("Онлайн", faced("online")), ("Пластик", faced("plastic")),
      ("Заморожена", faced("frozen")), ("Строка под картой", S["cstat"])])

comp("bnr", "card", "Баннер выпуска",
     "Тёмный — единственное действие на пустом экране. Кнопка внутри — лайм.",
     ".bnr .bg .go",
     [(".bnr", ref("alt.py", ".bnr{position:relative")),
      ("разметка", ref("app.py", "<b>Выпустите карту</b>"))],
     [("Обычное", S["bnr"])])

comp("sbn", "card", "Системный баннер главной",
     "Полоса в ширину плит: значок, заголовок и подпись, шеврон. Днём — тёмная база с "
     "подмесом бренда, ночью — поверхность --n100 и значок цветом бренда.",
     "#v-home .sbn .pi .pt .pc",
     [("CSS", ref("app.py", "#v-home .sbn{display:flex")),
      ("тёмная", ref("app.py", "html.dark #v-home .sbn{")),
      ("разметка (скрипт)", ref("app.py", "function sysBanner(){"))],
     [("Обычное", home(D["sbn"]))])

# Статусы и сообщения ────────────────────────────────────────────────────────────
SHOP = re.search(r'<div class="catfill cat-shop">.*?</svg></div>', D["cats"], re.S).group(0)
BDG = ('<div class="ds-row" style="gap:8px;align-items:center"><span class="bdg g">Активна</span>'
       '<span class="bdg g">Пройдена</span><span class="bdg n">Заморожена</span><span class="bdg n">TRC20</span></div>')
CHKS = (f'<div class="ds-row"><div class="ds-cn"><div class="oi">{SHOP}{D["chk_ok"]}</div>'
        f'<span>Успешно</span></div><div class="ds-cn"><div class="oi">{SHOP}'
        f'{D["chk_no"]}</div><span>Отказ</span></div><div class="ds-cn"><div class="oi">{SHOP}'
        f'</div><span>В работе</span></div></div>')
comp("bdg", "status", "Бейджи и отметки",
     "Статус цветом бренда (.bdg.g — фон и текст считаются от акцента до контраста 4,5) "
     "и серый нейтральный (.bdg.n). У значка операции — лаймовая галка или красный крест.",
     ".bdg.g .bdg.n  ·  .chk.ok .chk.no",
     [(".bdg", ref("alt.py", "^.bdg{")),
      ("цвет бейджа", ref("accent.py", "def tokens(")),
      (".chk.ok", ref("alt.py", ".chk.ok{"))],
     [("Бейджи", BDG), ("Отметки на значке операции", CHKS)])

comp("warn", "status", "Предупреждение, заметка, подсказка",
     "Жёлто-зелёная плашка .warn — про то, что нельзя вернуть. Серые .note и .hint — "
     "пояснения. Ошибка поля — красной строкой .err-note.",
     ".warn .wi  ·  .note  ·  .hint  ·  .err-note",
     [(".warn", ref("alt.py", ".warn{")),
      (".note", ref("alt.py", ".note{font-size:13px")),
      (".hint", ref("alt.py", ".hint{font-size:12px")),
      ("разметка .warn", ref("app.py", "Отправляйте только <b>"))],
     [("Предупреждение", S["warn"]), ("Заметка", S["note"]),
      ("Подсказка", '<div class="hint" style="margin:0">Перевод в сети отменить нельзя — сверьте адрес целиком.</div>'),
      ("Ошибка", '<div class="err-note" style="margin:0">Не удалось отправить код</div>')])

comp("empty", "status", "Пустое состояние",
     "Не «нет данных», а что сделать: значок в круге, заголовок 16/600, подпись 13.",
     ".empty .ei",
     [(".empty", ref("alt.py", ".empty{background")),
      ("разметка", ref("app.py", "<b>Операций пока нет</b>"))],
     [("Обычное", S["empty"])])

TOAST = S["toast"].replace(' hidden=""', "")
comp("toast", "status", "Тост",
     "Сообщение сверху под шапкой, капсула 14; не перекрывает кнопки внизу. Успех — "
     "зелёный фон --ok-bg на секунду («Скопировано»), ошибка — розовый --err-bg на три.",
     ".toast .toast.on .toast.ok .tt",
     [(".toast", ref("app.py", ".toast{position:fixed")),
      (".toast.ok", ref("app.py", ".toast.ok{")),
      ("показ (скрипт)", ref("app.py", "function msg(v, t, ok, ms){"))],
     [("Успех", screen(root_cls(TOAST, "ok", "on").replace('<span class="tt"></span>',
                                                          '<span class="tt">Скопировано</span>'), 150)),
      ("Ошибка", screen(root_cls(TOAST, "on").replace('<span class="tt"></span>',
                                                     '<span class="tt">Не удалось отправить код</span>'), 150))])

comp("done", "status", "Готово и ожидание",
     "Круг 88 цвета бренда с галочкой — «готово». Кольцо со знаком — ожидание.",
     ".hero .okc .h2 .p  ·  .ring",
     [(".okc", ref("alt.py", ".okc{")),
      (".ring", ref("alt.py", "^.ring{")),
      ("разметка «Кошелёк создан»", ref("app.py", "Кошелёк создан</div>"))],
     [("Готово", S["done_hero"]), ("Ожидание", f'<div style="display:flex;justify-content:center">{S["ring"]}</div>')])

comp("qr", "status", "QR пополнения",
     "Белая плита, код тёмный на белом в обеих темах; в центре знак монеты в оправе. "
     "Поле тишины 20 — меньше нельзя.",
     ".qrbox .qrw .dep-qr .qb",
     [(".qrbox", ref("alt.py", "^.qrbox{")),
      ("тёмная", ref("app.py", "html.dark .qrbox{")),
      ("рисунок (скрипт)", ref("app.py", "function drawQR(host, qr, coinImg){"))],
     [("Код «alt.vu demo»", D.get("qr", S["qrbox"]))])

comp("steps", "status", "Шаги",
     "Нумерованные шаги в плите: номер в круге, заголовок и подпись.",
     ".steps .step .n",
     [(".steps", ref("app.py", ".steps{")),
      ("разметка", ref("screens.py", '<div class="steps">{body}</div>'))],
     [("Три шага", S["steps"])])


# ── 5. токены ───────────────────────────────────────────────────────────────────
def rule_decls(selector):
    for sel, body, media in RULES:
        if sel.strip() == selector and not media:
            d = decls(body)
            if any(k.startswith("--") for k in d):
                yield d


LIGHT = {}
for d in rule_decls(".phone"):
    LIGHT.update({k: v for k, v in d.items() if k.startswith("--")})
DARK = {}
for d in rule_decls("html.dark,html.dark .phone"):
    DARK.update({k: v for k, v in d.items() if k.startswith("--")})
# светлых значений у части токенов нет — они стоят запасными в var(--x, …)
FB = collections.defaultdict(collections.Counter)
for m in re.finditer(r"var\((--[\w-]+)\s*,\s*([^()]+?)\)", CSS):
    FB[m.group(1)][m.group(2).strip()] += 1
FALLBACK = {}
for k in DARK:
    if k not in LIGHT and FB.get(k):
        FALLBACK[k] = FB[k].most_common(1)[0][0]
SKIP = {"--gap", "--pr-ink", "--pull-arc", "--pull-track", "--frost", "--hair"}

NOTES = {
    "--brand": "заливка главной кнопки, включённый переключатель, галочка «Готово», кольцо",
    "--brand-ink": "текст и знак поверх лайма",
    "--brand-600": "ссылки действия, «пришло»",
    "--acc-bg": "фон бейджа статуса цветом бренда",
    "--acc-ink": "текст бейджа статуса цветом бренда",
    "--spot": "пятно подкраски шапки (.tint)", "--spot2": "второе пятно шапки",
    "--card-a": "заливка под лицом карты", "--card-b": "заливка под лицом карты",
    "--glow": "отсвет на карте", "--sbn-a": "тёмная база системного баннера (день)",
    "--n50": "фон страницы и шторки", "--surface": "плиты, поля, клавиши",
    "--n100": "выбранное, дорожки, вторая кнопка", "--n200": "разделители",
    "--n300": "обводки, плейсхолдеры (не текст в тёмной)", "--n400": "шевроны, ручка шторки",
    "--n500": "вторичный текст, подписи полей", "--n700": "вводный абзац",
    "--n850": "основной текст, значки", "--n900": "заголовки, суммы", "--text": "текст страницы",
    "--ok": "успех, «зачислено»", "--ok-bg": "фон успеха", "--err": "ошибка, отказ",
    "--err-bg": "фон ошибки", "--err-mark": "крестик отказа, счётчик",
    "--warn-bg": "плашка предупреждения", "--warn-ink": "текст предупреждения",
    "--warn-mark": "значок предупреждения", "--info-bg": "справочная плашка",
    "--ghost": "карта до выпуска", "--ghost-line": "обводка карты до выпуска",
    "--coin-plate": "оправа монет, сетей и знака бренда",
    "--sh-1": "тень плиты", "--sh-2": "тень круглых кнопок, шторки",
    "--glass": "стекло кнопок шапки", "--glass-2": "стекло полей, плашка на карте",
    "--line": "обводка галочки",
}


def tok_group(k):
    if k.startswith("--cat-"):
        return "Категории трат"
    if k in ("--brand", "--brand-ink", "--brand-600", "--acc-bg", "--acc-ink", "--spot", "--spot2",
             "--card-a", "--card-b", "--glow", "--sbn-a", "--ghost", "--ghost-line"):
        return "Бренд"
    if k in ("--ok", "--ok-bg", "--err", "--err-bg", "--err-mark", "--warn-bg", "--warn-ink",
             "--warn-mark", "--info-bg"):
        return "Смысловые"
    if k in ("--sh-1", "--sh-2", "--glass", "--glass-2", "--line"):
        return "Тени и стекло"
    return "Нейтральные"


def resolve(v, table):
    """var(--x) → значение --x из той же темы: образцу цвета нужен цвет."""
    for _ in range(4):
        m = re.fullmatch(r"var\((--[\w-]+)\)", v or "")
        if not m:
            break
        v = table.get(m.group(1), v)
    return v


TOK = collections.OrderedDict()
for k in list(LIGHT) + [k for k in DARK if k not in LIGHT]:
    if k in SKIP or k.startswith("--t-"):
        continue
    lv = LIGHT.get(k) or FALLBACK.get(k)
    dv = DARK.get(k, lv)
    if lv is None and dv is None:
        continue
    L_ALL = {**FALLBACK, **LIGHT}
    D_ALL = {**L_ALL, **DARK}
    alias = lv if lv and lv.startswith("var(") else ""
    lv, dv = resolve(lv, L_ALL), resolve(dv, D_ALL)
    TOK[k] = dict(light=lv, dark=dv, group=tok_group(k),
                  note=NOTES.get(k, "") + (f" (в CSS: {alias})" if alias else ""),
                  light_from=("var() запасное" if k not in LIGHT and k in FALLBACK else ".phone"),
                  dark_from=("html.dark" if k in DARK else "как в светлой"))


def px(v):
    return v


TYPE = [
    ("amount-hero", ".amt", "Сумма-герой (детали операции)"),
    ("card-balance", ".cbal", "Баланс на карте"),
    ("card-cents", ".cbal .cnt", "Центы и знак на карте"),
    ("title", ".h1", "Заголовок экрана"),
    ("sheet-title", ".sh2", "Заголовок шторки"),
    ("section", ".hh h2", "Заголовок раздела"),
    ("button", ".btn,.btno", "Кнопка"),
    ("row", ".row .rt", "Строка в плите"),
    ("field-value", ".fl b", "Значение поля"),
    ("field-label", ".fl i", "Подпись поля"),
    ("lead", ".lead", "Вводный абзац"),
    ("note", ".note", "Заметка"),
    ("hint", ".hint", "Подсказка"),
    ("link", ".lnk", "Ссылка действия"),
    ("action-label", ".act span", "Подпись быстрого действия"),
    ("nav-label", ".bnv-i", "Подпись нижнего меню"),
]


def rule_props(selector):
    d = collections.OrderedDict()
    for sel, body, media in RULES:
        if media:
            continue
        if sel.strip() == selector or selector in [p.strip() for p in sel.split(",")]:
            d.update(decls(body))
    return d


TYPE_TOK = []
for key, sel, name in TYPE:
    p = rule_props(sel)
    TYPE_TOK.append(dict(key=key, selector=sel, name=name, size=p.get("font-size"),
                         line=p.get("line-height"), weight=p.get("font-weight"),
                         tracking=p.get("letter-spacing")))

SHADOWS = []
for key, sel, name in [("tile", ".box", "Плита"), ("field", ".fld.w", "Поле"),
                       ("round", ".ha", "Круглая кнопка шапки"), ("action", ".act .c", "Быстрое действие"),
                       ("brand", ".btn", "Главная кнопка"), ("card", ".card", "Лицо карты"),
                       ("sheet", ".sheet", "Шторка")]:
    SHADOWS.append(dict(key=key, selector=sel, name=name, value=rule_props(sel).get("box-shadow")))

RADII = []
for key, sel, name in [("pill", ".bdg", "Капсула, круг"), ("card", ".card", "Лицо карты"),
                       ("sheet", ".sheet", "Верх шторки"), ("tile", ".box", "Плита, строка шторки"),
                       ("field", ".fld", "Поле, кнопка, клавиша"), ("toast", ".toast", "Тост")]:
    RADII.append(dict(key=key, selector=sel, name=name, value=rule_props(sel).get("border-radius")))

SIZES = []
for key, sel, prop_, name in [("button", ".btn,.btno", "height", "Кнопка"),
                              ("field", ".fld", "height", "Поле"),
                              ("row", ".row", "min-height", "Строка плиты"),
                              ("sheet-row", ".m", "height", "Строка шторки"),
                              ("round", ".ha", "width", "Круглая кнопка"),
                              ("icon-plate", ".row .ri", "width", "Значок в строке")]:
    SIZES.append(dict(key=key, selector=sel, name=name, prop=prop_, value=rule_props(sel).get(prop_)))

FONT = dict(family=prop("body", "font-family"),
            mono=rule_props(".fld.addr .fl b,.fld.addr .fl textarea").get("font-family", "").replace("\n", " "),
            weights=[400, 500, 600, 700])
FONT["mono"] = re.sub(r"\s+", " ", FONT["mono"] or "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace")
SPACE = dict(step="12px", gutter=rule_props(".wrap").get("padding", ""), unit="4px")


# ── 6. запись файлов ────────────────────────────────────────────────────────────
def esc(s):
    return H.escape(s or "", quote=True)


def server_rev():
    try:
        return subprocess.check_output(["git", "-C", str(SERVER), "log", "-1", "--format=%h %cI"],
                                       text=True).strip()
    except Exception:  # noqa: BLE001
        return "?"


REV = server_rev()
BUILT = datetime.datetime.fromtimestamp(SN["source"]["www_index_mtime"]).strftime("%d.%m.%Y %H:%M")


def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def copy_assets(*texts):
    names = set()
    for t in texts:
        names |= set(re.findall(r"/assets/([\w.-]+\.(?:png|webp|jpg|svg|woff2))", t))
    (ROOT / "assets").mkdir(exist_ok=True)
    for n in sorted(names):
        src = WWW / "assets" / n
        if src.exists():
            shutil.copy2(src, ROOT / "assets" / n)
        else:
            WARN.append(f"нет файла assets/{n}")
    return names


# CSS кошелька
HEAD_CSS = (f"/* CSS кошелька alt.vu — как уезжает на alt.vu (ALT.VU-server/www/index.html,\n"
            f"   сборка {BUILT}, коммит {REV}). Поменяны только пути: /assets/ → ../assets/.\n"
            f"   Исходник — src/alt.py (CSS), src/app.py (APP_CSS и др.), порядок склейки —\n"
            f"   {ref('app.py', 'css = (CSS + APP_CSS')}. Править здесь бессмысленно: файл\n"
            f"   пересобирается из живой сборки командой build/build.py. */\n")
write("css/alt-vu-wallet.css", HEAD_CSS + rel_assets(CSS, "../assets/"))

# шрифт Inter для самой витрины — те же @font-face, что у кошелька
faces = re.findall(r"@font-face\{[^}]*\}", CSS)
write("showcase/fonts.css", "/* @font-face кошелька — для страницы витрины. */\n"
      + "\n".join(rel_assets(f, "../assets/") for f in faces) + "\n")

# состояния нажатия и фокуса — для витрины
press = []
for sel, body, media in RULES:
    parts = [p.strip() for p in sel.split(",")]
    hit = [p for p in parts if re.search(r":active|:focus(-within|-visible)?\b", p)]
    if not hit:
        continue
    new = [re.sub(r":focus(-within|-visible)?\b", ".ds-focus", p.replace(":active", ".ds-press")) for p in hit]
    rule = f"{', '.join(new)}{{{body}}}"
    press.append(f"@media{media[6:]}{{{rule}}}" if media else rule)
write("showcase/states.css",
      "/* Витрина: нажатое и фокус без пальца. Каждое правило кошелька с :active или\n"
      "   :focus повторено с классом .ds-press / .ds-focus — тело правила то же,\n"
      "   что в css/alt-vu-wallet.css. В продукт не нести. */\n" + "\n".join(press) + "\n")

# токены
css_lines = ["/* Токены кошелька alt.vu. Сняты с живой сборки " + BUILT + " (коммит " + REV + ").",
             "   Цвета — ровно те переменные, что стоят на .phone (светлая) и на",
             "   html.dark (тёмная) в css/alt-vu-wallet.css. Шрифт, шаг, радиусы, тени и",
             "   размеры в живом CSS стоят числами в правилах — здесь им даны имена",
             "   (--ds-*), значения взяты из тех же правил. */", "", ":root {"]
for k, t in TOK.items():
    css_lines.append(f"  {k}: {t['light']};" + (f"  /* {t['note']} */" if t["note"] else ""))
css_lines.append("")
css_lines.append(f"  --ds-font: {FONT['family']};")
css_lines.append(f"  --ds-font-mono: {FONT['mono']};")
css_lines.append(f"  --ds-step: {SPACE['step']};  /* вертикальный шаг между блоками */")
css_lines.append("  --ds-gutter: 16px;  /* боковые поля экрана */")
for r in RADII:
    css_lines.append(f"  --ds-radius-{r['key']}: {r['value']};  /* {r['name']} ({r['selector']}) */")
for s in SHADOWS:
    css_lines.append(f"  --ds-shadow-{s['key']}: {s['value']};  /* {s['name']} ({s['selector']}) */")
for s in SIZES:
    css_lines.append(f"  --ds-size-{s['key']}: {s['value']};  /* {s['name']} ({s['selector']} {s['prop']}) */")
for t in TYPE_TOK:
    css_lines.append(f"  --ds-type-{t['key']}: {t['weight']} {t['size']}/{t['line'] or 'normal'} var(--ds-font);"
                     f"  /* {t['name']} ({t['selector']}) */")
css_lines += ["}", "", "/* Тёмная тема: класс dark на <html>, как в кошельке. Его ставит скрипт в <head>",
              "   по настройке человека (Система / Светлая / Тёмная). */", "html.dark {"]
for k, t in TOK.items():
    if t["dark"] != t["light"] or t["dark_from"] == "html.dark":
        css_lines.append(f"  {k}: {t['dark']};")
css_lines.append("}")
write("tokens/tokens.css", "\n".join(css_lines) + "\n")

TOKENS_JSON = dict(
    source=dict(build=BUILT, commit=REV, page="ALT.VU-server/www/index.html",
                light=".phone в " + ref("alt.py", "--n50:#f6f7f8;--n100:#e9ecf0"),
                dark="html.dark в " + ref("app.py", "html.dark,html.dark .phone{color-scheme:dark")),
    color={k: dict(light=t["light"], dark=t["dark"], group=t["group"], note=t["note"],
                   light_from=t["light_from"]) for k, t in TOK.items()},
    font=FONT, type=TYPE_TOK, space=SPACE, radius=RADII, shadow=SHADOWS, size=SIZES)
write("tokens/tokens.json", json.dumps(TOKENS_JSON, ensure_ascii=False, indent=2) + "\n")

# страницы компонентов
SPEC_HEAD = """<!doctype html>
<html lang="ru"{hcls}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>alt.vu · {title}</title>
<script>/* тема — из адреса: components/{id}.html#dark */
if (location.hash === '#dark') document.documentElement.classList.add('dark');</script>
<link rel="stylesheet" href="../css/alt-vu-wallet.css">
<link rel="stylesheet" href="../showcase/states.css">
<link rel="stylesheet" href="../showcase/specimen.css">
</head>
<body data-ds="{id}">
<div class="phone ds-ph">
"""
all_markup = []
for c in C:
    parts = [SPEC_HEAD.format(hcls=f' class="{c["html_cls"]}"' if c["html_cls"] else "",
                              title=esc(c["title"]), id=c["id"])]
    parts.append(f"<!-- {c['title']}. Откуда: " + "; ".join(f"{a} — {b}" for a, b in c["refs"]) + " -->\n")
    for label, h in c["states"]:
        h = rel_assets(h, "../assets/")
        all_markup.append(h)
        full = " ds-full" if "ds-screen" in h else ""
        parts.append(f'<section class="ds-st{full}">\n<div class="ds-lab">{esc(label)}</div>\n'
                     f"<!-- состояние: {esc(label)} -->\n{h}\n</section>\n")
    parts.append('</div>\n<script src="../showcase/specimen.js"></script>\n</body>\n</html>\n')
    write(f"components/{c['id']}.html", "".join(parts))

copied = copy_assets(CSS, *[h for c in C for _, h in c["states"]])

# витрина
G = dict(GROUPS)
nav = []
body = []
for gk, gname in GROUPS:
    items = [c for c in C if c["group"] == gk]
    if not items:
        continue
    nav.append(f'<li><a href="#g-{gk}">{esc(gname)}</a><span>{len(items)}</span></li>')
    body.append(f'<section class="grp" id="g-{gk}"><h2 class="grp-h">{esc(gname)}</h2>')
    for c in items:
        refs = "".join(f"<dt>{esc(a)}</dt><dd><code>{esc(b)}</code></dd>" for a, b in c["refs"])
        sts = " · ".join(esc(l) for l, _ in c["states"])
        body.append(
            f'<article class="cmp" id="{c["id"]}">'
            f'<div class="meta"><h3>{esc(c["title"])}</h3><p>{esc(c["what"])}</p>'
            f'<p class="cls"><code>{esc(c["classes"])}</code></p>'
            f'<p class="sts"><b>Состояния:</b> {sts}</p>'
            f'<dl class="src">{refs}</dl>'
            f'<a class="open" href="components/{c["id"]}.html">Разметка — components/{c["id"]}.html</a></div>'
            f'<figure class="v"><figcaption>Светлая</figcaption>'
            f'<iframe src="components/{c["id"]}.html#light" title="{esc(c["title"])} — светлая"></iframe></figure>'
            f'<figure class="v d"><figcaption>Тёмная</figcaption>'
            f'<iframe src="components/{c["id"]}.html#dark" title="{esc(c["title"])} — тёмная"></iframe></figure>'
            f"</article>")
    body.append("</section>")

# токены на витрине
tok_html = []
for grp in ["Бренд", "Нейтральные", "Смысловые", "Тени и стекло", "Категории трат"]:
    rows = [(k, t) for k, t in TOK.items() if t["group"] == grp]
    tok_html.append(f'<div class="tg"><h4>{grp}</h4><div class="tl">')
    for k, t in rows:
        fb = ' <i title="в светлой теме значение не объявлено — стоит запасным в var()">*</i>' \
            if t["light_from"] != ".phone" else ""
        tok_html.append(
            f'<div class="tk"><span class="sw2"><b style="background:{esc(t["light"])}"></b>'
            f'<b class="dk" style="background:{esc(t["dark"])}"></b></span>'
            f'<span class="tn"><code>{esc(k)}</code>{fb}<em>{esc(t["note"])}</em></span>'
            f'<span class="tv"><code>{esc(t["light"])}</code><code class="dk">{esc(t["dark"])}</code></span></div>')
    tok_html.append("</div></div>")

type_rows = "".join(
    f'<tr><td>{esc(t["name"])}</td><td><code>{esc(t["selector"])}</code></td>'
    f'<td>{esc(t["size"] or "—")}</td><td>{esc(t["line"] or "—")}</td><td>{esc(t["weight"] or "—")}</td></tr>'
    for t in TYPE_TOK)
form_rows = "".join(
    f'<tr><td>{esc(r["name"])}</td><td><code>{esc(r["selector"])}</code></td><td colspan="3"><code>{esc(r["value"])}</code></td></tr>'
    for r in RADII)
shadow_rows = "".join(
    f'<tr><td>{esc(r["name"])}</td><td><code>{esc(r["selector"])}</code></td><td colspan="3"><code>{esc(r["value"])}</code></td></tr>'
    for r in SHADOWS)
size_rows = "".join(
    f'<tr><td>{esc(r["name"])}</td><td><code>{esc(r["selector"])}</code></td><td colspan="3"><code>{esc(r["prop"])}: {esc(r["value"])}</code></td></tr>'
    for r in SIZES)

n_states = sum(len(c["states"]) for c in C)
INDEX = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Компоненты alt.vu</title>
<link rel="stylesheet" href="showcase/fonts.css">
<link rel="stylesheet" href="showcase/showcase.css">
</head>
<body>
<header class="top">
  <div class="brand"><span class="plate"><img src="assets/{re.search(r'img-[0-9a-f]+\.png', S['fld_avail']).group(0)}" width="29" height="29" alt="alt.vu"></span>
  <div><h1>Компоненты alt.vu</h1><p>Веб и Telegram Mini App · снято с живой сборки {BUILT} · коммит <code>{esc(REV.split()[0])}</code></p></div></div>
  <ul class="stats"><li><b>{len(C)}</b>компонентов</li><li><b>{n_states}</b>состояний</li><li><b>{len(TOK)}</b>цветовых токенов</li><li><b>2</b>темы</li></ul>
</header>
<nav class="toc"><ol><li><a href="#tokens">Токены</a><span>{len(TOK)}</span></li>{''.join(nav)}</ol></nav>
<main>
<section class="grp" id="tokens"><h2 class="grp-h">Токены</h2>
<p class="lead">Цвета — переменные со <code>.phone</code> (светлая) и <code>html.dark</code> (тёмная) из живого CSS.
Слева в паре — светлая, справа — тёмная. <code>*</code> — в светлой значение не объявлено и стоит запасным в <code>var(--x, …)</code>.
Файлы: <code>tokens/tokens.css</code>, <code>tokens/tokens.json</code>.</p>
<div class="tgs">{''.join(tok_html)}</div>
<div class="tbls">
<table><caption>Шрифт: <code>{esc(FONT['family'])}</code> · цифры адресов: <code>{esc(FONT['mono'])}</code></caption>
<thead><tr><th>Роль</th><th>Класс</th><th>Кегль</th><th>Строка</th><th>Вес</th></tr></thead><tbody>{type_rows}</tbody></table>
<table><caption>Шаг и поля: вертикальный шаг <b>12</b>, боковые поля <b>16</b>, всё кратно 4</caption>
<thead><tr><th>Радиус</th><th>Класс</th><th colspan="3">Значение</th></tr></thead><tbody>{form_rows}</tbody>
<thead><tr><th>Тень</th><th>Класс</th><th colspan="3">Значение</th></tr></thead><tbody>{shadow_rows}</tbody>
<thead><tr><th>Размер</th><th>Класс</th><th colspan="3">Значение</th></tr></thead><tbody>{size_rows}</tbody></table>
</div>
</section>
{''.join(body)}
</main>
<footer class="foot">Собрано <code>build/build.py</code> из <code>ALT.VU-server/www/index.html</code> и <code>src/</code>.
Рамки «мини-экрана» у шторок, тоста и меню и подписи состояний — витрина, в продукте их нет.</footer>
<script src="showcase/showcase.js"></script>
</body>
</html>
"""
write("index.html", INDEX)

# сводка для README и проверки
write("build/manifest.json", json.dumps(dict(
    built=BUILT, commit=REV, components=[dict(id=c["id"], group=G[c["group"]], title=c["title"],
                                              states=[l for l, _ in c["states"]], refs=c["refs"])
                                         for c in C],
    assets=sorted(copied), warnings=WARN), ensure_ascii=False, indent=1) + "\n")

print(f"компонентов {len(C)}, состояний {n_states}, токенов {len(TOK)}, файлов в assets {len(copied)}")
for w in WARN:
    print("!!", w)

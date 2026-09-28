/**
 * The weekly email's logo, carried inside the message itself.
 *
 * The email used to point at images on followupbase.io. On the founder's
 * phone (Gmail app, 2026-09-28) none of them ever loaded, in light or dark
 * mode: three samples in a row showed no logo at all. A picture attached to
 * the message and referenced by Content-ID (cid:) is shown without Gmail
 * fetching anything from anywhere, so the logo no longer depends on it.
 *
 * Generated from public/email/followup-lockup.png and followup-lockup-dark.png
 * (re-saved with a 48-colour palette, visually identical, about a third of
 * the size); regenerate this file if they change. No white chip behind the
 * mark: the founder didn't want one (2026-09-28), and it isn't needed now
 * that the logo sits on the wash picture, which Gmail never darkens. Kept as base64 in code
 * rather than read from public/ at send time, because the serverless
 * function that sends the email is not guaranteed to have public/ on disk.
 */

export interface InlineImage {
  /** Referenced from the HTML as `cid:<cid>`. */
  cid: string;
  filename: string;
  contentType: string;
  base64: string;
}

export const LOGO: InlineImage = {
  cid: "fu-logo@followupbase.io",
  filename: "followup-logo.png",
  contentType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAOwAAABYCAMAAADBVutFAAAAkFBMVEUAAAAJCQkJCQkJCQkHBwcJCQkICAgJCQkAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACL1tT3AAAAMHRSTlMA/m/JLZBMrwAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAACDKzxhAAAEOElEQVR42u2caYOjIAyGJef//8fbemDCJdbZ2RlYPtFWgceEl3DYZfkwAS+TJNIQ" +
    "YA5UwfBKMgMqhy1NYFQNYRJYwIgacGxR4mATz+G/W4Ip/HdPNIX/jqxPpCXUIfVJyqgh6KChUjGNpk9URx0tWCQNrTRkBDwDLF6w" +
    "DqRPFK4STMQ6Tvwk16xhJladx4fHGWV7WEfxYg7zeHGXE4/ixTiRF0sXK/837H/D/uCk32JYeaVdDl+5fxZ4drGW5wCYJGgLPpwP" +
    "9/PmwruirBWdcxR4MMb2+/rXwXJ2+41e1iNPuAwC+6TD/jbYHi2mJuw399knsPxkzt5fzc+AxSfrE9VqSABA+mC3a+nrYLPKu7us" +
    "XvX3AmxcZudr2Lh4q3QM+4gcC/J5bMPK2pO4OlrKozW2MqwWpko1WMjkDczPmuQvYN+3tnbO211WabkPi6WnVYHl3IvIPKOQ5Pka" +
    "ttUD9dEMtgS7l4joCinDHq1zbo+xUDEGl6PxPbBYti0+Cv1Xc8iRTPvZdJE67LZogG+EfYtJHI2aAuK3l7BrebYd1/rEPfJYcBrX" +
    "0zFWWIRVq4B6mIJ8WSbPPbDo1KhnQaYzrs5hxSn4WWER1jcnlnE0XoyLSewRV7Dg+pNcinH3NkcOy74GPL4vwYp3ND4usbormQZf" +
    "wXo2bosx3lhYy2GTiCGyl2DBPxhxVqSt9PXqPa89sJgoSkuM9da0Ohco9E2JjlWCZT86UGzcdi2tHyHm9+dyAav+e6zr091tuorg" +
    "Lbm1SrCaDIWxcbo2mje+9UvjoFzUnRpsqMBq9Cj6MtimZRMFOS27oeF2mR55NbBUDLvblpXSUPOKbOljWLzRZ9k7kxGUNbe3HPb8" +
    "cSWkInt+4fssJbAxgoHGpOIWrHqAphqDVxBD5KKvZAVBUt2JdSRqDEnrOPHf/QAUfg7rxvWLcZZ8/Go+udPNmoR+SdRrggc/zmLi" +
    "7+gaC7fXiAsX2wK2GBDaERRan1AX66htFnsLiWs0mDzZH2zLTv+1p9rgAewenwItwsYijdg4vK4l8NOUkM53rI32J7HehtbqYG7j" +
    "jITOxdiPzk40Zj1JYe1ZT/aU2ZoFExtRbTHlnPVgfVUUPl3975jPyo35LPuOqBWlyYJcqi2BF9aL8OOzp9crFXRjpQKSkqX4IXug" +
    "eMNo8GCLvbJ8evR/+9v7Uon7F2cV8Vyzn1Oy3eNge0MiMSrpiAt55Y2lii8520VEf+Xa1m0QR/VygTjSeQJoqysOdZCtDctj7bE3" +
    "YWmwFwGasDjYgYIWrIx20LYFq6MdtG3BDncGqAErYTB9aiWd492d5jbPmO8WzuTFNJMXwwQvZV3ExYO+543z9NiKPo36mvf4r4y2" +
    "46dh/6uAp/HhUrCoy7jp0Y77r4YdG9WJ8fD/3nXuAU3w312cbx6Mm3AK/436hJP899z7/LbMgrr8AXq7Gum6kYZ+AAAAAElFTkSu" +
    "QmCC",
};

export const LOGO_DARK: InlineImage = {
  cid: "fu-logo-dark@followupbase.io",
  filename: "followup-logo-dark.png",
  contentType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAOwAAABYCAMAAADBVutFAAAAkFBMVEX+/v718/D18/D18/D18/D18/D18/D18/AAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACvBkyJAAAAMHRSTlMA/m/JLZBMrwAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAACDKzxhAAAEOElEQVR42u2caYOjIAyGJef//8fbemDCJdbZ2RlYPtFWgceEl3DYZfkwAS+TJNIQ" +
    "YA5UwfBKMgMqhy1NYFQNYRJYwIgacGxR4mATz+G/W4Ip/HdPNIX/jqxPpCXUIfVJyqgh6KChUjGNpk9URx0tWCQNrTRkBDwDLF6w" +
    "DqRPFK4STMQ6Tvwk16xhJladx4fHGWV7WEfxYg7zeHGXE4/ixTiRF0sXK/837H/D/uCk32JYeaVdDl+5fxZ4drGW5wCYJGgLPpwP" +
    "9/PmwruirBWdcxR4MMb2+/rXwXJ2+41e1iNPuAwC+6TD/jbYHi2mJuw399knsPxkzt5fzc+AxSfrE9VqSABA+mC3a+nrYLPKu7us" +
    "XvX3AmxcZudr2Lh4q3QM+4gcC/J5bMPK2pO4OlrKozW2MqwWpko1WMjkDczPmuQvYN+3tnbO211WabkPi6WnVYHl3IvIPKOQ5Pka" +
    "ttUD9dEMtgS7l4joCinDHq1zbo+xUDEGl6PxPbBYti0+Cv1Xc8iRTPvZdJE67LZogG+EfYtJHI2aAuK3l7BrebYd1/rEPfJYcBrX" +
    "0zFWWIRVq4B6mIJ8WSbPPbDo1KhnQaYzrs5hxSn4WWER1jcnlnE0XoyLSewRV7Dg+pNcinH3NkcOy74GPL4vwYp3ND4usbormQZf" +
    "wXo2bosx3lhYy2GTiCGyl2DBPxhxVqSt9PXqPa89sJgoSkuM9da0Ohco9E2JjlWCZT86UGzcdi2tHyHm9+dyAav+e6zr091tuorg" +
    "Lbm1SrCaDIWxcbo2mje+9UvjoFzUnRpsqMBq9Cj6MtimZRMFOS27oeF2mR55NbBUDLvblpXSUPOKbOljWLzRZ9k7kxGUNbe3HPb8" +
    "cSWkInt+4fssJbAxgoHGpOIWrHqAphqDVxBD5KKvZAVBUt2JdSRqDEnrOPHf/QAUfg7rxvWLcZZ8/Go+udPNmoR+SdRrggc/zmLi" +
    "7+gaC7fXiAsX2wK2GBDaERRan1AX66htFnsLiWs0mDzZH2zLTv+1p9rgAewenwItwsYijdg4vK4l8NOUkM53rI32J7HehtbqYG7j" +
    "jITOxdiPzk40Zj1JYe1ZT/aU2ZoFExtRbTHlnPVgfVUUPl3975jPyo35LPuOqBWlyYJcqi2BF9aL8OOzp9crFXRjpQKSkqX4IXug" +
    "eMNo8GCLvbJ8evR/+9v7Uon7F2cV8Vyzn1Oy3eNge0MiMSrpiAt55Y2lii8520VEf+Xa1m0QR/VygTjSeQJoqysOdZCtDctj7bE3" +
    "YWmwFwGasDjYgYIWrIx20LYFq6MdtG3BDncGqAErYTB9aiWd492d5jbPmO8WzuTFNJMXwwQvZV3ExYO+543z9NiKPo36mvf4r4y2" +
    "46dh/6uAp/HhUrCoy7jp0Y77r4YdG9WJ8fD/3nXuAU3w312cbx6Mm3AK/436hJP899z7/LbMgrr8AXq7Gum6kYZ+AAAAAElFTkSu" +
    "QmCC",
};

/**
 * The small icons from the designed email (canvas "Weekly email · designed"):
 * one before each channel in "Where customers wrote from", and a calendar on
 * the booking chip. Gmail drops SVG, so they are pictures carried like the
 * logo. The same shapes the app's ChannelIcon draws (lucide, Instagram drawn
 * by hand), rendered at three times their size with transparent corners, in
 * the email's dim grey (#736e68): dark enough on the white sheet and light
 * enough on the black one Gmail's dark mode paints, which never recolours a
 * picture. One colour for both, so no dark twins.
 */

export const ICON_MAIL: InlineImage = {
  cid: "fu-icon-mail@followupbase.io",
  filename: "icon-mail.png",
  contentType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAADYAAAA2CAMAAAC7m5rvAAAAYFBMVEUAAABybWdybWdybWdybWdybGZuaWhybWdybGdxcWZwcGgA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj41dcAAAAIHRSTlMA" +
    "/oiyzy8QdU0SIAAAAAAAAAAAAAAAAAAAAAAAAAAAAIFd16oAAAEHSURBVHja7ZbZEsMgCEUNKGD+/4MbHbcYHWn60HYmPDGtx4sX" +
    "lxjzxC8E46YK5AYiu6nDUqb89lb4hOF7GKQSQ867xoKdq5yEirXeBRckZlCF1xEGc8lQi2HRiI5Yp4Fc7BS2RrJiU6SelyI1gs6e" +
    "OgC1I34OeegaFy1Jv8iMkrwpTxj4BCKNIMr/ejhjdT6ZS0nb5JwR5Cm7VSUpIDPCqlc8cD35PMIMcd+LMhOZOXYMw3bYdZoJVtYf" +
    "Rg6KnmLFGmsbK9bYIdjcLVYuB2eGFcFOaoXlZV139wI7QBE3Pt1w71J4sP/EuJ4ULVZvGxe3rO4yj4d4v/Us4meP8M0n/+4HxhPf" +
    "ixcuVwZnqylZ4wAAAABJRU5ErkJggg==",
};

export const ICON_PHONE: InlineImage = {
  cid: "fu-icon-phone@followupbase.io",
  filename: "icon-phone.png",
  contentType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAADYAAAA2CAMAAAC7m5rvAAAAYFBMVEUAAABybWdybWdybWdybGdxbWdybWdybWdvaWdwcGRxcGiA" +
    "gIB0dF2AYGCAgFUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD1kAEiAAAAIHRSTlMA" +
    "/YfMSzCucBETJQMLCAYAAAAAAAAAAAAAAAAAAAAAAKt7KT8AAAF6SURBVHjaxZbblsMgCEWNCKiZ9v8/dxq8RRtbzMMML21cbo8C" +
    "CzDmPwzZirFDPeS2k0FUUnbrza1riXkF5WUnpbdZkg8Fxv35TinH/fH7gaEOs6dv0DllUNNix2NgHcN7mATgJuaXMXMTgz5QxylB" +
    "gR35xF1egzaVS+Ae6pxMPvlpyqrc6pzgFih5DrWHacsC1oCz1h/V51gPYC1G9ZakrQlVROSC2v9FBFqJcCtysnk/orHFFbm9hc4v" +
    "yHErtvBcqMzYvAlBhYkLwV8nZkAnhhO55HoP51YQLLQyT+Ml0l575mQPwue+4s+ruQlx8lVneOXNssq52eWfZOn/dcfKXGyXsxdZ" +
    "+M65oe+NlZ4nfbWsB7sNbUU22Emz2+hRJwFGo8DyzaY5MsOKx/m5hpkAH+aFOWY85WDhEvZ6YBakuISZnctIZHGf94uLF7bRiLiK" +
    "xu9FO1I3iRHlWae0iznIsL2bpvp6poGyyqLmHS1PfwWNr2rCY4L+lf0ChqAHpUvdBGwAAAAASUVORK5CYII=",
};

export const ICON_GLOBE: InlineImage = {
  cid: "fu-icon-globe@followupbase.io",
  filename: "icon-globe.png",
  contentType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAADYAAAA2CAMAAAC7m5rvAAAAYFBMVEUAAABybWdybWdybWdybWdybWdybWdxbWdtamdwcGmAYGCA" +
    "gIBwcGmAgFV0dF1VVVVwcGYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABPCxOQAAAAIHRSTlMA" +
    "/dBPr5EwbxAPCAMkBgsDUAAAAAAAAAAAAAAAAAAAAL0Z3HMAAAHZSURBVHjazVbbcsQgCI2gosl2t///tW0wKnhJsu10pjwRCLej" +
    "AsvyDyh6TwDkfbxtsqIDUwgcrjeMHtZ0ZP2FUXBmSC6cGD0nRjvRtMoIuZzP+jtmVzAJ+DjUuCxcHxHXtSyY3MFjZOWLUWLtYb3D" +
    "cRgOkAkik/0n+Ib9yQxrk11X3wfL7bbzWDxzWGQ9R4atMWOpSzykFLMYEutMFWciISNRBpZwGacODli7YEeZx6WDFhZ2FAQ2RYmt" +
    "xjbBUPwIVdeqRDgr/7QVm4yESrl8ROlRuc8RRilrDSf80VwDP/LpZFrUng5I2GUFKi2nS0sCGqQcZcL6rxzeKRhCqQYUqtiaWZWy" +
    "L4G1XJnhxCuZN4nqzXqH7G/MfpgkTqAaQlIRuziAmdegjtueHncQjej6crnRezi/ynZ2lfsndevhqGe63X6mnGXpnCdNYTNKF2QH" +
    "PGlBpIIdHdcLH6jSWkW/kChzdfDsOqrqVWm4hPZwslo28K6ZO70dQDM6oGPZM7TjLQ2qqENULtrxII5pLMYcYy8imKuxWEY3DYbw" +
    "ejxJf7Io1JGfcUIjMunplduDFQ+estC9pvsMwqwRAJ4uT5PGQtvVSjhYoNyd9TC2i+H9nZLXUPvWGvqH9AUNyQszmXG/4wAAAABJ" +
    "RU5ErkJggg==",
};

export const ICON_INSTAGRAM: InlineImage = {
  cid: "fu-icon-instagram@followupbase.io",
  filename: "icon-instagram.png",
  contentType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAADYAAAA2CAMAAAC7m5rvAAAAYFBMVEUAAABybWdybWdybGdxa2ZybGZybWdybWdybWdxcWZwcGlV" +
    "VVWAgIB0dF2AYGCAgFUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABng5suAAAAIHRSTlMA" +
    "/cdFFS20c4sSJAMCCwgGAAAAAAAAAAAAAAAAAAAAAPGbcmUAAAFPSURBVHja5VbBdgMhCMwCgm7S5v//tq27aQVFaV57CrfEHRlg" +
    "AC+XFzJK2FmiOUR4c4ylOKB32aYm9xEqwbYwSD0Kvw8H9jjDztfxf8Zh9IT5ODf+yGVhYtC31gzmeWmqQ+4owqqkYGnWi/YVbLeU" +
    "wLofG2tO11rNNazqwYSWjMw+GQALdSko+mdzXPKPNHIL1Nej5kxKZkA6B+jAyGqRIrDTl2ApKMbfBHaI4fySWCXZhxUjIW5p+jDR" +
    "ST4ilSWMraZz492Hdd2ITVHnsNRJIwSjroP/iyTbZoilxBagxArwZLkPd78W10PK+UvKOS7lJxsn3qbJTEl3KICSkBkt7ggirTwa" +
    "bIWRVcFctfPgnAQ7zN+Wa91OYdoi05y77sjRRaW/KRBbi1CGS1huY9DtfEXsf7PyG5xvOGTPcxB7keMEyDjL8uChVh9rL/RY/QCy" +
    "OAiwED6r1QAAAABJRU5ErkJggg==",
};

export const ICON_MESSAGE: InlineImage = {
  cid: "fu-icon-message@followupbase.io",
  filename: "icon-message.png",
  contentType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAADYAAAA2CAMAAAC7m5rvAAAAYFBMVEUAAABybWdybWdybWdybWdybWdybWdybWdwamZycmZycGaA" +
    "YGBVVVV0dF0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABo2aDjAAAAIHRSTlMA" +
    "/Y6u0DBwThEQKAgDCwAAAAAAAAAAAAAAAAAAAAAAABSC6XkAAAFySURBVHjazVZLFoMwCGz5Rm3vf93mRc0/EV2VXasThgHMvF5/" +
    "EE5VfCg7M2RToHcK0K8BtOK7CeQHoJByRnaB+B4hAgBipCvbCMWRlKbD+SyU3BRFWj/QA8gTlPSe6RCnUyaO+rg9Fw4Fc9g9NZwG" +
    "s97suPI/Cbnm80ZN6UugeDF/O87VBPRq7rii5C4Ly9TmsjLLclCRbtjmbrol/2Hbx1wDvBQ/BmSvmmRsWAYdPzbYJ2nJVh1PLTUm" +
    "RisMo+hi63XSRKoDjDCoDrgNe0BSnkmi7dZaGsD5fF5dKdn43hwu6synoTTIl325vThZnZYF2F53WVLRYusOhGRrSdndTWbNBtXp" +
    "ttqg/pqaPnjhY0pZn1ZD3xw014SBI3euRbrieKQqURyzs6B3FlK1wsnhBbiplbzLykyJpEr5NDjQkYga90PeziAl88UD9zAN+A4u" +
    "88PNMUODIZlcyiQc/VKRaGzvvOcs2+1YvE8D70P/wRT/AOWPB10R61R8AAAAAElFTkSuQmCC",
};

export const ICON_CALENDAR: InlineImage = {
  cid: "fu-icon-calendar@followupbase.io",
  filename: "icon-calendar.png",
  contentType: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAC0AAAAtCAMAAAANxBKoAAAAYFBMVEUAAABybWdzbGZybWd1aWlwcGBybWdxbGdybWdzbWcAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3SqeUAAAAIHRSTlMA" +
    "/kmDDxDKMa1jAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF6nm/sAAACbSURBVHja7ZXtCsMwCEV71al9/xdeCvswDZoNtjJGz68Kh2Bu" +
    "iS7LUZiq5eUeBjgv9zjgeRkQIyIFlJ7cSpOhYVT07a+YsYaTMcfibcCU9k0tm3Bd3JPKMtn0Rxztm8q8qRky2Nm/3OzLYGf8rj3n" +
    "KNu5wv8k79M+7c/YEuagl3Z7O9rNWC0emnbHvTe/X9C7VSJcLR5l+f6uvgIKtgYAknyv4AAAAABJRU5ErkJggg==",
};

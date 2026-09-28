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

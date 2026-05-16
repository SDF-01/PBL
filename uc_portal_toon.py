#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
+==============================================================================+
|            UC TEST PORTAL  --  UNIVERSAL TOON FILE  v1.0                   |
|                                                                              |
|  Self-extracting installer for the full E2E testing portal.                 |
|  One file. Drop it in any project. Run it. Done.                            |
|                                                                              |
|  Usage:                                                                      |
|    py -3 uc_portal_toon.py                        interactive install       |
|    py -3 uc_portal_toon.py --app "Acme"                                     |
|                             --base-url https://acme.io --out /path/to/repo  |
|    py -3 uc_portal_toon.py --dry-run              show plan, no write       |
|    py -3 uc_portal_toon.py --agent-guide          print AI adoption guide   |
|                                                                              |
|  FOR AI AGENTS: run --agent-guide first, then edit CONFIGURE below.        |
+==============================================================================+
"""
from __future__ import annotations
import argparse, base64, pathlib, re, sys, zlib

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIGURE  --  AI agents: these are the ONLY values that must change.
#  Edit this dict before running, or pass CLI flags.
# ══════════════════════════════════════════════════════════════════════════════

CONFIGURE: dict = {
    # Shown in the portal header and HTML reports
    "app_name":  "My App",

    # URL the browser navigates to during tests
    "base_url":  "http://localhost:3000",

    # Role slugs for your app. "anon" (no login) is always available.
    "personas":  ["anon", "user", "admin"],

    # Cards shown in the portal UI.
    # marker: None runs the entire file without -m filtering.
    "groups": [
        {
            "id": "smoke",  "name": "Smoke Tests",
            "description": "Critical path -- login, home, key flows",
            "color": "#4f86f7", "marker": "smoke",
            "file": "tests/e2e/test_smoke.py",
        },
        {
            "id": "all", "name": "Full Suite",
            "description": "Every test across all flows",
            "color": "#4ff7f7", "marker": None,
            "file": "tests/e2e",
        },
    ],

    # Test account credentials per persona.
    # Store REAL values in .env.test after install -- never commit them.
    "credentials": {
        "user":  {"email": "test.user@yourapp.test",  "password": "TestPass123!"},
        "admin": {"email": "test.admin@yourapp.test", "password": "TestPass123!"},
    },

    # Default portal port
    "port": 4000,
}

# ══════════════════════════════════════════════════════════════════════════════
#  EMBEDDED FILES  (zlib-compressed base64 -- do not edit)
#  Contains: portal.py, custom_runner.py, reporter/, pages/, config, conftest
# ══════════════════════════════════════════════════════════════════════════════

_FILES: dict[str, str] = {
    "tests/e2e/portal.py":
    (
        "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"
    ),
    "tests/e2e/custom_runner.py":
    (
        "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"
        "lWCm3Y1jCsdx3DS7NjaP/ge4qMRZ"
    ),
    "tests/e2e/PORTAL_SETUP.md":
    (
        "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"
    ),
    "tests/e2e/reporter/__init__.py":
    "eNoDAAAAAAE=",
    "tests/e2e/reporter/models.py":
    (
        "eNqNUk2L2zAQvftXDN7LFjYhLcseAoGmSbqElqxxuqdSjGyNY7Gy5EojqKE/vmOpmxw2hergsWbee5qvPM+3ggT0"
        "VqL20FoH1CHsPuzAqaYDh4N1NM/zPGud7aGq2kDBYVWB6qcQCGMsCVLW+CxhJAs2WniP/hV0dt1Bq1DLBKRxUOb0"
        "inkaJhGhsyz7eMZn8QtHwqHExjq5zICPMhJ/LdlQvEr0jVORvwRPLjqHKQO5hNpaDSv45gJGPzpnXYTBbzhYgxyc"
        "TAyyDqLxnaWqfri/ggK4gVp4fLifoWm4axKKw+MdGAsdConuWvrPHjfMKdEHTakCw9RKyfTC5dzAMBJ6inFQEm6D"
        "UT8DwguO7yIxNFdoExHnpznkz5tZMVss3ufpFdHjWyyDu9ALM3Ocsag1QvAIDWcYCal76DxP421+hRYjTk3ZWB6H"
        "MoLsdNsqh036XctemckG6tiUn9abKMkjInSKNbXy9J2Ff3BT4z7cSmwF96ZqxSQyriZEqtfz6P1fymUN/o8pKPhU"
        "wQryYnfY7g+P+bmQ9fHI6X1e77+yOX7ZF2x2ZflUpp0KLm51xQqttoJYYzFfXFao6tF7ccJ/rVICkRMN1qJ5uQb7"
        "A97sGE0="
    ),
    "tests/e2e/reporter/step_logger.py":
    (
        "eNrVVl2L3DYUffevuDgvNt0VpIQ8DExpCEkItM3Spk/LIjT29YxYWTKSZneHNJAfkV+YX5IryZ/zAe1DH2KGmfHV"
        "0ZF87rlXzvM8+8tj95vZbtHCty9foTLa45O/boUWIeZoGCxWxtZ09yj9DsTem1Z4WYGrLKJ2O+Mdy7K/Hc0AqUGA"
        "R+dXGdBVYxPvuDMt+p3U28Khaq6gU+KA9iou4MoEDle8Z12gWvegdNdfz2AjdQ1GVwgdbSmQj5Pj/hJD+C7yDx1q"
        "6KxppMJ8tkq4enItHuRWeOTecPOoeY8uysusr5xD60GLFuFBOrm5SC4icuDkyogaa6LOSfnGmhY4b/Z+b5FzkG1n"
        "iFVobTzJa7TLsj62EQ5fvhjuvBUVbkR1nyj6lCm5GSj6SJ/DhPKHjsQfEO9QoxXeUAI+dGEtobKECxt/tHK788wd"
        "dMVFJ4dJN8TWo4LqjuHPyCyGMXrU1tSo3IANtvoz2ibLskqRDjA5LUlFGrw2SmHlXZSyThonuU2/K7gZ97OwWxBw"
        "NBjnUkvPebRWCde/wB9G48xTFGY8sq9ASedvp+3dkc1u75bQ4LfVKMxteO4AC6Rp0Wfw7esX+sDNfqOoEF7dvO8j"
        "P9YnPc2vR34ZZI1mT9VaI4kvoyAritso8mii26DMFUzfd5P2IVHD/9dpHRiaS2MsNQtHvlQYLRWXZBNedKE2XACN"
        "uQfR+FD3O4SNMtU9ub3tFNJ0KLrgMyJthFQlO7sHWT9RKhXqYuaKEn6C5yOE2h1BJosU1HDwaU0zF0KsZ/+nZuHt"
        "YdkJDhJVvYgQPws7Jcev4aPd4ziKTxV2Ht7EH6IF4UJsdXn6W6EcngyjtaTCGpr8E9U9FsRRMs5DlXH+eQWfKPA5"
        "P5k2icw3L1/Q/CRRldIw64hHRcVER322LohjibFCznZH7QFX/8+io2eHaedtS+z570Lvqa/0wPxMuyC7fBT3SK7r"
        "29LkPbP3TtZhKB6MyYAFsi27glbW1zGKDwSh86lk/9F4Z55u8fQzSy7ikX706MnQBc+eApOr1sGSp4PLPK2PsrTE"
        "T0krjxrme+oAlpqq+yH75dgy46kz91q0UXDYP0dmks10poB0R6OpCIhFp9PlYhex4nEojcA0q5qi2SvFQ3Adm0F5"
        "jjy9QDBKHBmTDuqC+EpWY/yfC1dJmZcX29Dl/abzg15v6FXMH0Zp0gujm5Q5PnRX2RFbACwKY1bSCoX9F0c7S8Ay"
        "+w6Wsceo"
    ),
    "tests/e2e/reporter/plugin.py":
    (
        "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"
        "dX1QSaN/AGCawjg="
    ),
    "tests/e2e/reporter/html_generator.py":
    (
        "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"
        "NVlbrlCaLLpu+D8Ii0r3"
    ),
    "tests/e2e/pages/__init__.py":
    "eNoDAAAAAAE=",
    "tests/e2e/pages/base_page.py":
    (
        "eNrVWFtv2zYUfvevILSH2J2tZAMGDAY8oM0yLECRFkmLPQQBQUvHMmeZFEjaiZEV6I/oL+wv2eERdbPltB320ASG"
        "LhTPd+4XJoqiV8ICK0QGTM//hsSxzx8/MbsUBlK2hLwAY9lCGybynLbZOIqiwcLoNeN8sXEbA5wzuS60cUwopZ1w"
        "Uis7GIQ1A+XuQrhlLufV1rf4Wn5wu0KqrFp/U3hykQ8CVS5290ZmSxfbnUq4KGSDkMGYvdaJcNqMGTwUKH4gc2Cd"
        "jeFniBOtFrJGP6e3wWCQ5MJa5pX3MNMBw78UFqiTVNJxPrSQL8ak8ZQ4jdjkN3alVdjr//yWmEw3o43dD4HxLPAc"
        "jgb0/Qf2+dNH/LErsZUZ2SqsPK/foDZZpp2uzeWWU2adQbWj06jHZhuT1yaJX728ueDvr1/HBklkMSSSHwnl0Mgx"
        "8UH6MbsX6KKNcjKfRQrcvTYrmeYQjRqhaAvGLUeCRjgHRpXy/YNxGb8tV8bMyTXojZsyqRyK99Mv/Ozs7CmPxx38"
        "Yg9nFu4teZKNMaAc97qRPISOkjTgBjCZVIsHQscGMAMSGO5ZbMyiaD+gXloLhnLvmQdUmcl8K62c5xC8l5d5Pm0S"
        "fs9pvx7xWYk2DPSj2Gk+hxr8uMeCFA4e3HER8ONhPH2dEEuxhRLdXw4Zo/c51hAnpLJBALuZ+0RRGfE8zqYOoYaR"
        "D1Pjq+G6kKg2PoJNRIHWrTBHo/2AulSojUioRFWt4BmEz0LmVcrjFe3hXYY6jtlW5Bs4Zrsm74KXhhX1KCZIom6n"
        "dC6TVR+jbwQvcVrA5SeuqRP+z5p0sfdVysDx+Y4bXaedfww8lVhDFeyeIeacv5EAISMaGVb3wmQWtzxGni6aEvkH"
        "Jhf0wCDHsePxw/Hi1xbFX8bsxYsSdORDFIcGFEZmShu4xdWJX7g70CQXc6iCgZ4bmx2IfEyEEoOuh6bygwaXaWAR"
        "3v4Dkwon3PsY1XWorjp+6MH8nLK51r6t/iHQqt/KNxSggDWj634l+Au73fdfAr5QF+qW7bSwbthJl8qo1fR5i9a9"
        "CwHe32mIvN/WOCCTwWhsZsTt1CqRrObCMByQ5UIm5eDnNBNFAcLQUN0SiLLVD1G3PvZnJxan6o09uRuzsCBy7PX+"
        "PSZ8XE+FExOrlQIzobW7BpHeEe7pGodTWJeinnKGnj/MotA1o55JpyLEBCdT1gutvkSg1JNCY2v3v71Ipb09zrN4"
        "WEAVeYaeqfLhK6e3tl9yLVJ/6ghw1rsilbbPG+WOXut1lIxKF/gMlim6rKQjHwkl12jAiV9DVwkjxYQKyuzkdSnI"
        "SctbB74wu645A/SBe5YyTUE95R14SKBw7IJuGIFd3MKfiTDrr3StdWHA4txKp0K3FO4ET4NSQY9jvGG4AZHumvn2"
        "i9OzdwMn6Yd7k3yHqN/7+1XqJjEAyi7186hVrYZfCx4ium61ZEV/VG6s6E8QzRHq5vz64uLq5s83727475fX7JQt"
        "okdqtXGhsqhDhbb3Z5B4vUqlGZYvdvbObMAXf4mNR6/oddTjspaMHmuGwtHDaMwWmzwn9+8Rh0ym49zRs6+vid+r"
        "t/ZmPa7EludSrfoHioNic+6JsANYmYJXE8uOE/MJdQGxZR6JzXesqQa0A4thp/74rX21B+eqbd0OVG1QLCSjNm2n"
        "0ZdDzOHEKS0XG7fEePCdCdImg/1k0VHqunSq9zTV+iX4Fob/MdL3lnVA2PvLjiIhHKJTv+s015lUkW+HWLa7h97B"
        "vyUgPVc="
    ),
    "tests/e2e/pages/auth_page.py":
    (
        "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"
    ),
    "tests/e2e/config.py":
    (
        "eNqdVlFv4jgQfudX+HIvVNpCd/dpkSqdS9ySOyBVElr1KTKJAWuTGNlO29XeSvcj7hfeL7lxnIQApa2KBCKebz6P"
        "P09mxnGc3pgVWtIMJaJY8XUpqeaiQCsh0e3VFGHJCorIF4I0U1oNegGjqUIrKXLEikcuRZEDAXqkktNlxhQCxwFY"
        "BgaPVjxjg54D2/B8K6RGQvUq3y3Vm4wvUb18C4/WkAoN3s16Jmga26Ver/PQNw79ODb8cXw22FJpohgip93bOev1"
        "eklGlULj6mijHoLP7whvtxlPqmNWK1c4JPEimI6Q0hJdQoiDNas2cRqT8wk5G623o+EwEwnNNkLp0deLiwvYxFBM"
        "CHanJAxHaClEts/R2AyHliVzzgaZeGKyf4YuL+uliiSc+vfxzB8hDie5NL/9Dk1tNSywq932KvDvQxK8FLi1GHSy"
        "AVl5mTtn5vDNE/ob7kaylXiGf09s+Z3rXq2Py1a0zDTSPGei1Ar1c2X3c8k1XkyjOPJmxF9EJyI9QJkYPl9UWlmW"
        "Ob7zbnDk+fM3iADYJfnakNRxRibBSsUkSiRL4fo5zRT6759/kSgYokkiSmDdgh2+ShS08dswxVBegjd75vDLC3QN"
        "WiwpLONSb1BfMnghIJFZXmZUC2kDv53iBxJAnD+rR/NxWE555oy62kckjGKLjckMe1X2mIwcbDP6g8k/tsvs3OQr"
        "rfP0045uC+n6JGR6mvEWh+G9H7iG1ChwW3F+/vL1tz0iuFyl44LmDKgcnLFnp2OFt2JntAxdc8qVCXXPHe3BftlL"
        "GPsQiTfHkf9OWToOB9okAo7NC6P2BwXqch+qNDbsb4j0J0BocVKm8S7A17SyLOgYXUvmegEZv1uvBn0gVgrpmnxc"
        "qZb1UCaXv5VJMyHXr4jk1oG9ppClQAfQWh7szrz5+7SpoAfC0DTnxQdVsXyHkmDD+IYoIc1PKlL5vyYHOKMu6FdT"
        "39qa1FQh1Bdb07VoZuvRApoTmS2mJuNf6jzGfg1XXXWxBmjOtYJCeboPNcgYL6LJy41xd5qWvwK3rqd65reLb9/s"
        "Lm0ZD6F6s0JthGnfjzxlAlGp+YomWtm+OA4ImYcTPwpN5o6qYQHCOTkCSGZmB+WY/6plV3bfO88l/geIqsiAo446"
        "gM7IbHx2xrALo1aZiT8jwO0MnXZp6t9Uue0MKXQZUGUNl95aQ+9mvrjdmRVfF+V2Z7/2gxs/avNzB4RRbS30eZvZ"
        "rccdCbzrB/uG7OCPTPLVj3P7VrVYF4eTKx/XvH2DNB0VxiSWng1TqjZLQbvkth2FFdz2NXVojO88ct8FDB85ezpC"
        "EdeL9lAs5foIFRIcjCd7OMWoTDY75Hi6uLIBJVm5VPuGGLIIR2RnHkJmwOl2qNlDfMAwzH90bo/gmwWx1ozRdck6"
        "O0yx69ogQ39eY2iaMmmChNnjGGqOFbsQ0R7aHO08hbBe4g5DmJn2uZWCenAMjfAcOuHNfiCaFtCR1sfM4wkZ/+Xt"
        "MScblnw/76Zn5C+COZ6ReWRZtSilKWGF7goNoNoO05fsmuZ+5F1742rus4hCwFteD+IdYNMBIF2rqrhv6FxRZT68"
        "aguCyhd0QWZKPALhRZN4FkTLKu/+BxDouos="
    ),
    "tests/e2e/conftest.py":
    (
        "eNrVGttu28j1XV8xoB+WRGUmmy2arQA1q9jKxoA3Nmx5t0AQcEfkSJo1xWE5I8uua6BPfe5Dv3C/pOfMheToZhlw"
        "gqyRSJ7buc25j4Mg6JzfKSYVmfBbtaiYJLTISCqKCZ8uKqq4KMhEVOT87SkZVKygZPhqSPCEjDudd+YQmXFW0Sqd"
        "3fU6hIwrsZSsSgCIYrcqodVUEvL7f/5LbjhblqJSXZKLlOasS0pWzbmUgEWunyTmB0+KguFeIpneTEK6UDMiFVUM"
        "PkXFMr0M/6UoaASwSjplZO2nDQuZgI1SsVJu3HgJK6diOoW9Y7EAsShB1IwRmip+wzQGOI+UJBrbC1Lm9A7ot6M4"
        "jjUcYOeGFZwVqTlExPg3lirZCUD8k0rMSZJMFijIJCF8jhKCWyiE0uKXnY6dE9LsLqma5Xzstp7D0Cyou5IXUzf/"
        "IyvgVkA4NYBSX7XZO6HXwJddeIcDCxxYWFZ8OlOxvCvShJbc7Qo7KJm35pKOzB119dw5cGV/q4+bsYZRtiajjqVV"
        "qxB7xWKjbA7JkR6t7kGxSZ+OQTbnRYN4ANfQjI7yxbgZHVM5GwtaZc3UKc0yVrXGjE4XzOfDrUer1FQM6WBVjLqT"
        "5EZFLHGN0gCjIFbSN9INgfEDfVeSLGcMjKalwlySlKYz0GIpCIPfnCaDsuZ3YC1gQbyAQWpUt1oUnWRwNXqfXI4G"
        "o+FlcnxyAYgQegi6xHPQpAiEBgarQBGDGHEFa0fi+XXGq5DdcqkScd0fVQsGZHYyNiGJ1mtNXoIKF1qKekByFZHD"
        "v2lsPS2sioHyFmSNohdkEtzbcw/xb/AVdFAKv//v3/CvpSuw09o+WLhalHbHV/UPKP/BGFBsfWUoU1GyfmCdUhBp"
        "wTXKnvAC5Ad3Fmp51fb4sWUk5AO4I/P5yQhzyVEtfLMBAFSScml24M8dZzn4vOW+VDnXCi6ChRtI7LVuIzJo7BEJ"
        "inVf4w3SGdgCX8yD3iZOY7fcbU5MeMUm4nbLAbva2r9k42uutmw3i2b3Q1v5HLUfjQOJ316c/XI5vPj0RAGFbUE5"
        "QYAE2tNxThdFOgtrkmeMZjlA61vc74eD49Ph5WXDlMzFMpkLt+Hy9OyX5Kczsx51mgsdG4RxmgvJwtoW5+BBXFR0"
        "FHZJ2yLJv7QOAaX4pfXNd9SGFYg4RxVDl0Nri7NwuyBJDKUYQSS9AV/UdlATQm8oz+k4ZzGGLc1U7RwA7TZ/EeFZ"
        "581YLpkm0J4XFThYcwhAABthA0AfbI11YtIMY+21ZBhFLagabKpumwuLC7asJVdfh0tE+vfBkmfgGnvk21ffv+yS"
        "YMZQ32D8/cuXD839mXylH7Di8OoyaOYVn7N/AuaEZ/1gMGcVT+mLoxl8TkVrWyvN6X8MpkwgPAzuwadmU2sa6Mrh"
        "F7XIGJDy3cv41V9evwLqclFM3ezhX1/Hr//83bcPXUIOIPxJxYsuGf290bm2ePveqEFasVRUWXLDMyYSCAb9RkgG"
        "RhVanf355Hh4pv26vhkh4ylTrLgJg4vh0dnFcaI3BNHKJWsNbys6XE8MTj4BxaaLXCUoQrFQDs3x8N3g6nSUjE5+"
        "Gp5djTafKegNn2pJrR7/MPj55MfB6OTsgw/BegkA5EUgVh063UT9hXAJV6dY5oxCggYaN3GovUYWkecKJnWQrZHu"
        "tvBdNq2/LwyLa4ZNdIKSYQIBQeRXC/PX2OQ9q6kFespDyC9MHYBJiTRJb+MMIA3OuLyOPez7OYOWge52apGxZVA0"
        "yIM3mX0TCnVK3dc6gsaOwzCqVzXd/To9DHHZX40lnxYQYRIqfTprzWubTohU9FdcVeQR03jvNc3bO4NoqiAnmpUc"
        "YiUNX88jrJQf0bDAIAvaQQhJdbw3gWgv0lMB3oQXSOEXor+F8bmYADcI5dkX48Chey7yKRZGX4h2jWsPwj2Pq/sN"
        "2mrrpkM4gYxKPbub3dsPa1+EJCVOtK57YccQcubM+OHa69YOF2wIXKhjgYSFcJyRDOMrijzSbRSvtrMo6nxKU+Lw"
        "V+wfC5DTauWABen6bTU3Zo9hbLaQbmi+2MxOtKcLtbWGaXe4tKGE/YCEKvCEDmkhMqArgMUE0qU8MDQ2gMCb40GM"
        "LPAdTyChZFnPSziQrhYbCFF/8Ayr7pxCMRW8AMBBEkTNTK9npzxYNhi5nPvoYjj8cPn+bNQUp+8GJ6fJPeJ8iMti"
        "GqwdtzW0LZTNQOo6uUtWyub2UVXd+WzVoUGmFWOFnAnVBBIdQrqgP3muRb8BILtNWanIUH+Bjm2CLuXjUcjdvzbJ"
        "CzYFDkzbrE6DVuySliU0IFb8DpADPTCY11kD6nS06pragUzbFejW03TaaJ1pj62bZ+AHySCqga+7ybXI9FkI2hD6"
        "HqeqDjWfhaTVQPY4PSZ2fBZivLDkU1JHh6vCz8K1Mn6FvaB9ukNGnoUw4twSh7eIcp8Mud/41u3ue8V1e35hR5Ru"
        "db6dyf8hbmH7Reguv+nDNcz59dN5JbAMhhcQj3+I2lj/pItKd1M1ZNMI5xDHuNrwKtAz6GJ7L1LMrTGYxn9c38cV"
        "VMoAgcqebfvpY/gJxssgVnDt7YOoh48JHrXWoTeUruRZgOLQoPPeH2rP/hXaintICWur6Wk+9K25As7rONdVXX1i"
        "m2Mz4SJciUgt+E3D38PQTK+e3Y0pyfUDww6EzQuEh7CZfiLCFJ48dqBzLyIeMjf5VN70Y8ku3urXFJ+3evqJCDP3"
        "gLMDp/fI46H1VvbF3Arn4abc4Uk3uQnAPomKFfRj+B+V9lPwu6QhXMtN9tamtZOPpj+W0V0oH+dyb7Q6FQn9XKft"
        "atzLou9r3OzKQc/tjrC0zaii8CaQY6D+w8TN7X55UXDI1LR/0WWjiaJQuHjimQSad9QBco8Pn7E5F4+FmvHJXYhJ"
        "TP+bN28ODw4Ovokegt3YjEI8js9c/3NgZHMoR7fh0od2InljkPxQjvNDLBNpjGe89873QlxDpG9KQIJ/XAFYMb/6"
        "E4FSGrsD5u8RIKkwr8zk+S51BvjhlToPoTyFZzepbCGL88sKKj1W2dJTu159KIFWsP7GXNRQFHLF5j27Hp/AoEuw"
        "3LeNEWjGp0IX8Tr57DTtAruCvYkEUhBo5NssVNo+AtewdP8gAIFgjwCeygt8mSptHQsvHY2Y7OuFdCmYlZhNe6SZ"
        "LPPFFLozKS1gnWY4N+803QiNgfT70EnElkWv9XwC9+DKF6AeiYuxx4N/z4I8hIHeEnj9DS7rR18PQLeVqUV+9Y5E"
        "JKA2ibn5vo85tjzWR/B55REAHz91/g9hwTWX"
    ),
}

# ══════════════════════════════════════════════════════════════════════════════
#  INSTALLER LOGIC
# ══════════════════════════════════════════════════════════════════════════════

def _decode(b64: str) -> bytes:
    return zlib.decompress(base64.b64decode(b64))


def _patch_portal(content: str, cfg: dict) -> str:
    """Inject CONFIGURE values into portal.py PORTAL_CONFIG + BUILTIN_GROUPS."""
    app  = repr(cfg["app_name"])
    url  = repr(cfg["base_url"])
    block = (
        "PORTAL_CONFIG: dict = {\n"
        f'    "app_name": {app},\n'
        f'    "base_url": {url},\n'
        "}\n"
    )
    content = re.sub(
        r"PORTAL_CONFIG: dict = \{.*?\}\n",
        block, content, flags=re.DOTALL,
    )
    groups_repr = repr(cfg["groups"])
    content = re.sub(
        r"BUILTIN_GROUPS = \[.*?\]\n",
        f"BUILTIN_GROUPS = {groups_repr}\n",
        content, flags=re.DOTALL,
    )
    return content


def _make_env(cfg: dict) -> str:
    creds = cfg.get("credentials", {})
    lines = [
        "BASE_URL=" + cfg["base_url"],
        "HEADLESS=true",
        "SLOW_MO=0",
        "BROWSER=chromium",
        "DEFAULT_TIMEOUT=10000",
        "NAV_TIMEOUT=30000",
        "",
        "# Test credentials — fill in real values, never commit this file",
    ]
    for persona, c in creds.items():
        slug = persona.upper()
        lines.append("TEST_" + slug + "_EMAIL=" + c["email"])
        lines.append("TEST_" + slug + "_PASSWORD=" + c["password"])
    return "\n".join(lines) + "\n"


_PYTEST_INI = (
    "[pytest]\n"
    "asyncio_mode = auto\n"
    "markers =\n"
    "    smoke: smoke / critical path tests\n"
    "    auth:  authentication and session tests\n"
    "    rbac:  role-based access control tests\n"
    "filterwarnings =\n"
    "    ignore::DeprecationWarning\n"
)

_GITIGNORE_FRAG = (
    "\n# UC Portal\n"
    "tests/e2e/.auth/\n"
    "tests/e2e/reports/\n"
)


def install(cfg: dict, repo_root: pathlib.Path, dry_run: bool) -> None:
    e2e = repo_root / "tests" / "e2e"
    writes: list[tuple[pathlib.Path, bytes | str]] = []

    for rel, b64 in _FILES.items():
        raw = _decode(b64)
        if rel == "tests/e2e/portal.py":
            content = _patch_portal(raw.decode("utf-8"), cfg)
            writes.append((repo_root / rel, content))
        else:
            writes.append((repo_root / rel, raw))

    writes.append((e2e / ".env.test", _make_env(cfg)))

    if not (repo_root / "pytest.ini").exists():
        writes.append((repo_root / "pytest.ini", _PYTEST_INI))

    gi = repo_root / ".gitignore"
    if gi.exists():
        gi_text = gi.read_text(encoding="utf-8")
        if "UC Portal" not in gi_text:
            writes.append((gi, (gi_text + _GITIGNORE_FRAG).encode("utf-8")))

    print(("\nDRY RUN — " if dry_run else "\n") + "Files to write:")
    for dest, _ in writes:
        tag = "(exists — will overwrite)" if dest.exists() else "(new)"
        print("  " + str(dest.relative_to(repo_root)) + "  " + tag)

    if dry_run:
        print("\nDry run complete — nothing written.")
        return

    answer = input("\nProceed? [y/N] ").strip().lower()
    if answer != "y":
        print("Aborted.")
        return

    for dest, content in writes:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, str):
            dest.write_text(content, encoding="utf-8")
        else:
            dest.write_bytes(content)

    for d in ["tests/e2e/.auth", "tests/e2e/reports/history"]:
        (repo_root / d).mkdir(parents=True, exist_ok=True)

    port = cfg["port"]
    print(
        "\nInstall complete!\n\nNext steps:\n"
        "  1. Fill in real credentials in tests/e2e/.env.test\n"
        "  2. Update tests/e2e/pages/auth_page.py selectors to match YOUR login form\n"
        "  3. Update tests/e2e/conftest.py login logic for your auth flow\n"
        "  4. Add your test files; register them in BUILTIN_GROUPS (portal.py)\n"
        f"  5. py -3 tests/e2e/portal.py --port {port}\n"
        f"  6. Open http://localhost:{port}\n"
    )


# ══════════════════════════════════════════════════════════════════════════════
#  AGENT GUIDE
# ══════════════════════════════════════════════════════════════════════════════

_AGENT_GUIDE = """
+==============================================================================+
|                   UC PORTAL - AI AGENT ADOPTION GUIDE                      |
+==============================================================================+

WHAT GETS INSTALLED
-------------------
  tests/e2e/
    portal.py              HTTP server + full UI (~1200 lines)
    custom_runner.py       JSON-defined step executor (Playwright)
    PORTAL_SETUP.md        Full human + agent reference
    .env.test              Credential template (fill with real values)
    config.py              Reads .env.test into typed Config object
    conftest.py            Pytest fixtures: browser, auth contexts, page objects
    reporter/
      models.py            StepRecord + UseCaseResult dataclasses
      step_logger.py       Context-manager recorder with auto-screenshots
      plugin.py            Pytest plugin: collects results, writes run JSON
      html_generator.py    Standalone HTML report builder
    pages/
      base_page.py         Generic Playwright helpers (wait, navigate, assert)
      auth_page.py         Login/signup page object -- UPDATE SELECTORS
  pytest.ini               Marker declarations
  .gitignore               Appended to ignore .auth/ and reports/

WHAT YOU MUST CHANGE (CONFIGURE dict at top of this file)
----------------------------------------------------------
  app_name     Your project name
  base_url     URL tests run against (localhost or live)
  personas     Role slugs e.g. ["anon","user","admin"] -- anon is always free
  groups       One entry per test group card in the portal UI
  credentials  Email + password per non-anon persona (placeholders only)
  port         Portal port (default 4000)

WHAT YOU MUST CHANGE AFTER INSTALL
------------------------------------
  tests/e2e/pages/auth_page.py
    sign_in():   update get_by_placeholder() to match YOUR login form inputs
    sign_up():   update selectors to match YOUR registration form
    update the login URL if not /auth/login

  tests/e2e/conftest.py
    _authenticated_context(): calls auth.sign_in_as(persona)
    Make sure AuthPage.sign_in_as() uses credentials from Config.

  tests/e2e/.env.test
    Fill in real TEST_<PERSONA>_EMAIL and TEST_<PERSONA>_PASSWORD.
    These accounts must exist in your auth system before running tests.

  tests/e2e/portal.py  BUILTIN_GROUPS (auto-patched from CONFIGURE)
    Add more groups after install by editing BUILTIN_GROUPS directly.

WHAT TO LEAVE ALONE
--------------------
  custom_runner.py        Generic step executor
  reporter/*              Fully generic, no project-specific code
  pages/base_page.py      Generic Playwright helpers

ADDING NEW STEP TYPES (custom test builder)
--------------------------------------------
  1. In custom_runner.py, add a branch in _run_step():
       elif t == "select_option":
           page.get_by_label(step["label"]).select_option(step["value"])

  2. In portal.py, add to STEP_TYPES JS array (search: const STEP_TYPES):
       {v:"select_option", l:"Select dropdown", fields:["label:Label","value:Value"]},

PORTAL API
----------
  GET  /api/groups               list builtin group cards
  GET  /api/custom/cases         list saved custom use cases
  POST /api/custom/cases         create/update use case
  DEL  /api/custom/cases/{id}   delete use case
  GET  /api/custom/groups        list action groups
  POST /api/custom/groups        create/update action group
  DEL  /api/custom/groups/{id}  delete action group
  POST /api/run                  {group_id} -> {run_id}  start builtin run
  POST /api/custom/run           {group_id} -> {run_id}  start custom run
  POST /api/run/single           {node_id}  -> {run_id}  re-run one test
  GET  /api/run/{run_id}         poll run state + results
  GET  /api/history              last 20 completed runs
  POST /api/save-prompt          {prompt} -> writes reports/fix_prompt.md

QUICK DIAGNOSTIC
----------------
  Tests ERROR at fixture:  test account missing or .env.test wrong
  Tests FAIL TimeoutError: selector not found; inspect element, fix locator
  All auth tests fail:     cached session expired; delete .auth/*.json
  Portal won't start:      port in use; --port N or kill the process
"""


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="UC Test Portal - Universal Toon File Installer",
    )
    parser.add_argument("--app",         help="App name")
    parser.add_argument("--base-url",    help="Base URL to test against")
    parser.add_argument("--port",        type=int, help="Portal port (default 4000)")
    parser.add_argument("--out",         default=".", help="Repo root directory")
    parser.add_argument("--dry-run",     action="store_true")
    parser.add_argument("--agent-guide", action="store_true")
    args = parser.parse_args()

    if args.agent_guide:
        print(_AGENT_GUIDE)
        return

    cfg = dict(CONFIGURE)
    if args.app:      cfg["app_name"] = args.app
    if args.base_url: cfg["base_url"]  = args.base_url
    if args.port:     cfg["port"]      = args.port

    if cfg["app_name"] == "My App" and not args.dry_run:
        print("\nUC Test Portal - Installer")
        print("-" * 40)
        cfg["app_name"] = input("  App name [My App]: ").strip() or "My App"
        cfg["base_url"] = input("  Base URL [" + cfg["base_url"] + "]: ").strip() or cfg["base_url"]
        port_in = input("  Port [" + str(cfg["port"]) + "]: ").strip()
        if port_in.isdigit():
            cfg["port"] = int(port_in)

    repo_root = pathlib.Path(args.out).resolve()
    print("\n  Repo root: " + str(repo_root))
    install(cfg, repo_root, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

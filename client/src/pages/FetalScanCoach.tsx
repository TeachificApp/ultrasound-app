/*
  UltrasoundAssist™ — Fetal Echo ScanCoach
  13-view sweep sequence — data sourced from iHeartEcho™ / All About Ultrasound, Inc.
  Brand: Teal #189aa1, Aqua #4ad9e0
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import BackToEchoAssist from "@/components/BackToEchoAssist";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { ScanCoachViewMediaCard } from "@/components/ScanCoachViewMediaPanel";
import { fetalBilling } from "@/lib/scanCoachBillingCodes";
import {
  Baby, ChevronDown, ChevronUp, Info, AlertTriangle,
  CheckCircle, Target, Receipt,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const BRAND = "#189aa1";

// ─── CDN Image URLs (© All About Ultrasound, Inc. / iHeartEcho™) ─────────────
const CDN = {
  sweep: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/pwtXDnxySsEwDrgH.png?Expires=1804217678&Signature=RjLvt9Fs6sbCplyJuBgyeMa3moRHLqXSn5sgXkxbmEMk4zq8JyWJ3uhIlW4xlIMySe1iUKmIoWUsxw9p9gF96ayg9wsQylH0Nf9uugH4tvoyJl4HQcDNZU~eh1UNmWKF2MXx7bp9FDJAKsHla8WuCu6j7rQv50qEaNFCJOqs3cRpoGZNyQhABCzpMPopJJR-V7rzIrebcwNPvB8Zg8J5g2gIr3FW1OVQhuO8G4zOKG2u69c~yiQEdqnxcUd5JeBGdxlMIR5wvaKUn384nUBMhSO1rhEq6WN2eHyFtVZNVnWb0ZPPPP-zYaA5Y8tzPs70r~IuAvDl8uPMxmtIWx8elw__&Key-Pair-Id=K2HSFNDJXOU9YS",
  abdominalSitusDiagram: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/ZMTandoYWqCfTVQG.png?Expires=1804219541&Signature=FFw3aLQMd681Ktzg35mIlyajenWZXm5SUyNpFH4Jy~AHqYVioMYaUNqtxZ410Uq9GoNPRcBd6W~zQ5~ddPDzfo7jHB6sc7B~DlmsQcWFSYre6CLyWRhxYC~CBrJk2bq0oh84jf5WLgoc95f70H3wOc~JamfxXXSOE70VM~~2jd~2rQOm5vkLA6QzLMvZANC2XAPlaAoKhGk-Hkfjv4Y7WTlcudoywE2Wmkk-5zHslwi~DDh9UJjeS6HE6wNVfb0Gu9uytxKRAS3r65i8TeH4zNq7kZStckHZmpiPOCgEFg3nKq7UZFIfnyanhi37z9~E3sS5MSbrQX89pvWMEfaHnQ__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoAbdominalSitus: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/oJAqycRWgaGIHUKy.png?Expires=1804219546&Signature=r2K1V3-P-GnIhbORET95gATIoTUFWXd4AxZeqCiDXB1yXQJUXk6rojvOLenXmx~VmkqxROoBJmxj6onaUz62nTTQY4QDKKW1zhZvxCH9yANnYkXZPy-nsmnEeqQCAq~CutfguKZSfj5wub~YDQ7voe2y38IZQqC6TcG-rk7ZElwB~GRqAXhFwJ5p3zlfzhCWZXt8SyXk0rCtfdGVuz1JYqz9QMZ3mGBkz-Zbe4ETNy~Rc0f1OmWAL0M9NDGp~xKExY9cpKO581Z6MbeV9aJ3IbdNMwy~7xsBtXbuJPGxt880EuruzfcVom0mlQj7I9uGX-Fa-1QlQ9Rp9FCxJB9njw__&Key-Pair-Id=K2HSFNDJXOU9YS",
  fourChamber: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/CLtSxqdZHBcCumkP.png?Expires=1804217683&Signature=VOxwYTn3wPLwSAG0YLL5zwY5flGx68Jw1pRhxySaq219-kolUuyAnCsaARBvuiZ0EdFnpZjTg-9ikyzFAcXWaog7l~T17sj9zDG5p7bVmBDBQckRWNOCxJW4emBzz-qlyvSMpyXcBBLAPXas~OB5TV2R7GJwN86IbGuYujQnAlR5WsY2lnCC9DTrIjsqdXZS1C-EOjS8X3Gzj5gim6FQYDTRr4U-B28fH0~gbJxskTbEZpuXG20W9U-J9jtvnUHhK2GG-amhyQ13s4M82UX7Le~~JrGHXMjrdhM73ZLNyxJVgiYETzpPyj9GiTwu~Q2sr6mWZA5HjnRWKLfCnX1mww__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoFourChamber: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/FsCsjnyeqmklIFoo.gif?Expires=1804233214&Signature=Jo-rvA0xYhTpV7FpI0syHloTxxRoJiBlV0rJI1~IGZecYYEx3f4yNshsAc8ax0QpKf~B53bd8QD2kiBTZe~ervKNZTE2ZpCDbVck9siO8HP-RafW3dUV7LyxpcfKqbjpXCQf5yWWIuJnFBm45zPPA3ungtCqppNxY~4h2cw0r0a0MKWvuSh8fUe0Aht54BF4NZ1vQWqs7kl6hQO2XVtQR8vRvAzKCjj8XzWbg78n8heVnyN-1hI9PTD9aQTEsKaHX2e7wGlgkeFiJiNQMXUtkZi9PuGWsrAVC7zmXyDs0UTCjwdMeVFmWWX43Eb6uSDB6-gjrisk3YVxrk5VgRBJgw__&Key-Pair-Id=K2HSFNDJXOU9YS",
  lvot: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/HGAQPXIReqfTNBKy.png?Expires=1804217687&Signature=T-bR51dg0rI8c71vd~9W491Gd2a5cjZQ17GFS-RQW7zqc58OE4pAQbhUnMQl7Q0D8qj9gzdYl3BbkQX34XEYBGw~Ha7uD5j62v8cJ7Wk-wMPFdD1p-DhmCyMBhQBw-Hv3uOutyxhKZjOflH4MWJkkuuNdRGATanGjZGDdbu3lZWjLRJFoY3Y8nwQiUFNppYJZejwUgT~0nBkIEo5Kr0-igVQzPrDcmk7z0xhHhluDBgGknAbnW2LnrtLnusr0AK2~TyHUa9JzQ9RXX4VS3nKLpq4bopk1cLFz7YIM-AvsIgfFIIW2TFFFMEIOPRr9focbem9CDh7~TlzNFtqYh~FDg__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoLvot: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/yKTaXDyqcalQLhSz.gif?Expires=1804233215&Signature=g4HbckpFIDhN6fx3cSxgsyvYDzMyWlpOkTxc97yWNiiKiPd6lAf5E2uJ-YSOLEFe8tdyvqjhXDPV4u1oZNL8AJ7JrT4OHaJksXCOW4OzI0QBoE2GPUWgquV616lITbBm2L96i9s0Da5~~Y9UJITA0lZEZWb78XnvO-lFo0iWEhjcqRQvfvzuhHkstx637ZQxyhW48GQ1ma5I9RFW60ImcpVLyt68Ce6Ja8K~2eE-qOS6~-9hUlPN31WoF653il1zAueq8W11fopkD14LiQu2YYKWJirqbb0s0NVGJhcR9dzHTw4jjywnHOt5e4P1SCZkKkw666ocYWVQH3eq~7KBbg__&Key-Pair-Id=K2HSFNDJXOU9YS",
  rvot: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/zkMTTtxmdDbJFPnT.png?Expires=1804217677&Signature=V4cp7hA2Vxz5atyyJ8Yf0xJ3P8ZqagZR95YqE-M1oK5TqjCU4LF4Qhp2MduyF4N0qoHaWeyClQ5zMlUd29ACTMXbrFxP~6bNQIDqAz7jTtLxwykK3s9BHsyqhmHpomzoFJo~3JsDFUtaJU0EAe18sFHpWjRVZFWaP7jt9SyJwet2KLQMo-1Bv0QZXAmzG7R7QnaMgarZXI-EHqMexKk1Jet8iQRYBF3FkF3PQ9IiEvI4FggvcECes7ISyqrSprlFiNbP1iy5qrZzpAkSyc3p5hh8-Lh4FhUTk-vysmW4iHMkNm8KV0ylswYQCkpYAC3QHa0G8If-RroFHveEo8L8-A__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoRvot: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/mfSQNxAuERDAcTEN.gif?Expires=1804233215&Signature=KMndkGZCsadxq8BfXsFHLTQWw3BUy3JdWA8kxttgOr2q2LRCiqYvDrRrza5fnvQa1jjxaWzXVlVQY5N9pJSQzm99yqlUt44jcD4dPN4scbRgjiVGOS2CE7yC7x4k5YoZkacVrUw1MSLlRUXdaZdSEDhyiF3IhGYim2wdRHlL7mV~20bP7dRQP2q9nV6KqjLc-645Zqa0N3WFX1fK04ZTka26BTDi8P6n6gjqo5MXEGmz3FEKIh8oD4tk6QTcMBo~YdAanw8fO1p399X2o8YHJCks7ft97X2TO00wTEtugZkcNsVQgYlLDrx1Wx6ulw0mLAyBZ9Ho49~0LARfOT1XlA__&Key-Pair-Id=K2HSFNDJXOU9YS",
  rvotBifurcation: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/GJOvhZIPNnIgAQHJ.png?Expires=1804217677&Signature=DE1TDX9Xf4hMNW5e-clWZiIE978WXpn3gem83T5ZCyWak6ow~kp1aOal6LNqjRpC7fJ-UDQUS4carcg5RUNMWTNDQ~8Wb11MYxn0FfoujGIER3e0Iw56cOrJp2cEBCM5~DfQEtjtu3ELZW-wKLAtTuDfyYCeEquCqrE32eI4da1yy~2kpfdBHUR2Jl9ts3O4kwHwLmOoVnLhDiZGmF8EPHFeQgSLSwbDXGfk4QJ8z0WZwOT2B81YakA0VgAQbstTmR2~pZrT7OhHD1dg3-Pr3tYH0bC3yhRVd7ZhgnmK39sjd3ihjJ0fUf2fUCyhBOwGnviqKjs05pjM6a3Fnai6OA__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoRvotBifurcation: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/kjNujbopvYeXuXRd.png?Expires=1804219531&Signature=EtSFpEBvcFTPWEa5CBlr89rmS8MMPCHN4QwtQ1TGHb202PKKEEeYq5MadcYUTWLq7miAnnnwXls7ViZu~-349O4ki3lmeRRjGlIog7m4KazgEoJmQX6jzm2kgtCZS6-SjbTUlEK4tiGbkJofCe~hq7E-q9xULBwy2pyF1tYn6mFrIYOOzBJgSohf0KSoxWFkSjpY7UTDMGtIUmJb4A0i~RO7Wb~~oIvqZfQOzLZMeOfINzdG5r6SoJoXaCLWiUmNOnN4SDvIMj7kbPQbM9e4~wyAdH5HOrYENIfBMZ2-8L1aZQpnX6xXo3~ksdUxKMJsahORgJYa0sa362bD9TSUBw__&Key-Pair-Id=K2HSFNDJXOU9YS",
  threeVVDuctal: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/tqIbdiftEiCjCtBg.png?Expires=1804217678&Signature=C6FTzFhtUc5TnxTwnvOO8K-~5y7vUwR9ZY-ndHTL~W6Y1~DU6JRY-CVCxtXqiM4npoJtq7BrgNNWQ7l8AdysUP2gB9g~I89JzVd0Xbxgrw6Cj2CLI5wAVpMTjDMBXxhHZyJtxNHHM8at81J2-aqsbxllARyMKMuq3yViQHLhZ7IiP~R14zDpFDn8KfXcpRTQbrYlJXu2G76L4Kuvn4G3rJVhpI4bEzAUKo4SNEeNJkHsH9YQpuqyzNQ93uPzpDxzwk09wR9CoyUMW-ZGBm~JKB6KNBnYSWXWY~Qrbp5OBuPk3doqj5n7vFqZO3kmQ1IS89rWDrDwxGilXuYqb8o6hA__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoThreeVVDuctal: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/tqrBgqVGzZDYoeXM.png?Expires=1804219557&Signature=CDFJzl4ikVN-wm7kjYAzoizilDf9Iv6EBn~R71yWirmTgSC53Poukur~PZNKd26ndivYsur2qwZk3Ek7XE9oFNED3UhQVk0IHnBm4t8wm6lHZsjRH7dUTuGGKLYVC2BiPm6rHxBTTn94UtcOvAmlsYyazQgGiaKp5BkNcOQYYZaeLS-yQ0hkJmBVbGreICidn6NmxWkgP-ies5kHeJg6IO72epeSJFV0QfgxLVwLUp0jZ1D5j0cL17GwVsk1RtDbJ09Q6VN~IORZGWznv7EGAw3t0317AJ~2i5p6ZyZdKKMoDQOlCQcKP8ITqsOe~99Sc6AVkmxFzFxaYfmjZdQE~A__&Key-Pair-Id=K2HSFNDJXOU9YS",
  threeVT: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/wXdhYtXSmjdILGLY.png?Expires=1804217678&Signature=AbYSjgEbF67spokqJE6r0QiY-amruwTq9ND5JdHR0VAnHM2LUJJcqwwVKI6xkXbbXFXthhMfWWVhNPrQYoWhfuKiejlnwBD84A2MRxS~PHqlkobnY1mshHUA8Mk1a1gvxk0b9rmy7TPiO6PDNBr2yeP0d4HHB5qveWfZV6Ef6N8ujxuxsWUGDGy4H~FvgwksZGIaPRCznwi1G5WEp3Bx-8jlj6FkvQTlJsRo-mhb5REPXlqDXDKtgzQW-t6Hrl3lmxYUgFA~3Mp4uM4WMbf--Oq0CSi3nMlNIIDWuCRZ22CSG8C9C9-cl6K0BquXgBoKRxJ8Xn0fRzWaErym-y3-Pg__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoThreeVT: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/ViQyJlALqrvWVEph.gif?Expires=1804233216&Signature=hR0jVOZM3YaZV9QOcE1TuzhklM6UJz9fNcOsNODCk~PU2mXsB7AaeMvsvV8d0CiOD7~TgcW8ql2MaPbLQiuzkX4FvSZ~JC1Tszv-qASoqsp4NMiwL3Vb7IPGQZlbxPGK21RhU412Q3emtUqPQ32bDeB9C-bdtPEkQTmNoIOfPukOIEiJOFRlTo8ZQGygYTBEofmhnT6X55FIV7r314~IHXYHvGQUe53TdqbYWnkrAKy6dkNIOAqyOXvvn41YOzZsbetKy1U1kXMIKNvbYTKcgxh6w2oSOlYeVkMeWqy1mMCEJVnItNbweHg4hsGT3lsc5N3w8o5zBaPa6h9XMdyAkg__&Key-Pair-Id=K2HSFNDJXOU9YS",
  bcv: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/vRqqlQSitiQuZxSJ.png?Expires=1804217678&Signature=XacRQ2a0loWf3gCJH2fWU~KTUNBawZUALgm6ZeTq5bTLjnycjlI15ykab6dSXGO82fiuyczm9ePOC1vwpJ76ZyYkS7f2ZHO~BAGREmsYOxdmb-jDbaZP3e9MfC9F~5JNFeQPcFXXEEKKAkFbhtYfF8nOub3tZHkcuonV~JW3Yr5rDSOAn6KKAHRttn2zy895eBqOzLozU2eHtWwSN3Pcfan1y7fZBeyrz-26R0wj~nWDcWSC6tPEg90g5ycjMx74E5LAC2UzXJiBVVVoRvf~IZsdnKk7WWqOEWDLW9rMRYPIA2PkapLOs7BM88PV0q0McPe0N8kZZiW4p5AGi-fsDg__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoLbvc: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/VizJommhsipdzIeA.png?Expires=1804219531&Signature=XYTjAWg9IqlCByRfuqWLeJXN-QsTAi-KPfu5csTu50s41cV9Q1DlYx6bwvbg69-Aakl0Uft0rMPQcD96hppPaDU-QuNYZOgu8x0-66yMpIqD5mcny7cTMaQIN-lIfqUCGfo5uHVHDSjZcDcACv1PogJLqYu7RTUCbvRVx4GZNp7JW5xTY09cznC6YJFT60gIUvx9nso6rHc~JlsCMjJ1GXiv~7hIab~PEghsjLIam2Pxpyv8~qIiPfByRfYeJz0Y9dl3l4NQ5ND5Y9XREXmqm6slDL10~YEiItHVi6FeHczsEcTd8MZj1A~2D3-il5DWnvdSYVfc~k4F0Sx1GU3QUQ__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoLvShortAxis: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/vQTOAothgRTPuaXI.gif?Expires=1804233216&Signature=pXA93W5yVReHPuxvtUUDsys-TV7UlEN1k37XkiZZViCxzfCfQDnET0hMKIg0URmyfPXm-dTha7qRP0LZSDMETBzIQrdIKCsjrosMXdYgHG7niz7dYe6GZBJj2-av8vddtG3p5Rk3XDZ-GdLBsHQLfoiY--ICtRwsCJqCxvSQo~zt2WI8OQh5iSyGMMKr-ANTFib8a8hXWeshGuLB8ObDkjltkxUxHVJ0z7pryZXRLa5AxFWp4hS4Bs70Tcl~rWKzPb7D0TJqnD0tvhBXh3fDN3NhBlfNCv7gBTxBe0sRDXDHgmQpYQqXsow35-ntBFSfNB8iXcI1K2unUHtI2uy21A__&Key-Pair-Id=K2HSFNDJXOU9YS",
  fetalRvotSaxAnatomy: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/eAzSlcLjWuskBlIM.png?Expires=1804233087&Signature=sDbjIEusdQS3ymQSQy61DT5drOjwCubFVtpxsRn9KIz85ry2cstjOtQhGRgqiT2nFZuV3cCUGfmOV8TM7yZuB8JidA0Ut3lioFv6VrsCyR1dFl7nnUEX9o3zZRJOuf2~t~zPNym8Ru5GqiOHTkjEehT6Sw~QWi9~XVaJ9mWRPBaSdltkacu09bZii-Z~lz3Rb8XjcIONdtW4-HrRbTA4-dSoFcTk3g9Tz4G7D1XNODaUKSyIYopNAtly-nexHYUVrXFTyzS3xn9myjCf5zcLqAlU9xk1vfcBOUC7EBPQo6EITrr3r4MLmDbN~5G8spe9JwccHkYJZI-yL~aufeHudg__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoRvotShortAxis: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/DIECWLBAWgIaNYNW.gif?Expires=1804233215&Signature=Wxc0ufcYwvkFut37XoiZY7FaEFyGBx0xEUPRmtaua79GJpC3NRKEK27TmiwHX-IuuWFK65JgRGP3fYPqGoeKg9ztup5tHl3OsBZe5W4weWO-aKAj63y3EkesP9JhJ6gN3RHX4CnO3Ca3IzVH~AqsM7Skw~o~sSQ3vlIGGJDvDLpezG364WNprJXTBU-AgC9K~is9lKg~5gOeohZSLxdVHJDM026zJl~o8Gzt-m1fGGpBC27F9rQrgLORnT9EQlbNTfQUjOa7AXzblZHK2u7Xyp5Lk3lOHlc9WiTVKoZEZgJFQAcy03Nmg2fmbBQ__&Key-Pair-Id=K2HSFNDJXOU9YS",
  bicaval: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/BFlsjzXHQURCTgXJ.png?Expires=1804217678&Signature=Rf32-AAr~a1IBc1WxrGdLCuI4XZPy9ov4CEuKdg68bE~b71p8o52rAKqCbi5UfU6SAhkJI6fGPcWLli5B90y24re5WX2Q9wOIXBefLgEzPLnHY9a~EniZUij48wwPA6De0eQ7UPgVSMAgswXcmOYcNMM~lsO3PVp-3F1gVyj0Y0RD4UACDSyxMXgZAYzaTfxzLTIjHI4zbXhxZMFnDL8w3zr5FUTZefcqrV95fYKwZQm2d3mrx3Lw~8XTIWcEQZ1uOx~2GJnLopHAvOPtJqhVjLOLvr9~7X~1JuTGs3YTz3R6g4JJjmaX17xJDvFo3b2M6twyqGU~H0DqZwCL1t0fw__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoBicaval: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/XLCPDDlQZLNxHWxC.gif?Expires=1804233216&Signature=CcVMmOffRsFpxh4KAiCQwUbbH~IomT3QLkOiniMUD3i6i2MFPH~WjX62H1Em8QYz~KcIiwyUaqSeRfburxSkMe1vm3nAgYtsPtXBjz2INHrbq2gO4MCDn4nzGHko0iaVIZMK3PxfoukVX6H6jw5i5OIgs7pi-eZOqS7NEybsaC4PPmKqRDkYYKAY52fF4EHHBgpjI36whW-7bxz-JAI7cJTaPuj0wDPVss7m~oY3ngaEJsP1zswt7WseSQMM2CoEhbyRWPd2eU1JhnbHDQ1OdK58Dioq9lhROpD9vBLbfQr~6ywjat7oGs1eeXMFeQF7hfXKCDalAhW-fJE8gC6nbA__&Key-Pair-Id=K2HSFNDJXOU9YS",
  aorticArch: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/TKlJMYtocuCBKwbl.png?Expires=1804217678&Signature=eojPUlijwGlowVGglOvcT3zQY-LR8gK11wJQnfC2qZlnkawEQfTx~e1s8wviyiQcQsp7dMfGrw5NN8m98ofDYz7OYUjLTd7jzv56cr6X5m12PJRJndtZOiNvSBd3QNgHNZ3gZaV3QaiM-ozMrtEQMZWL11l0LhmLcTGnc9wULnDMyqTm1RvcBrbZMZLagDQkuAO~fQOtDHZSDVh2DVXfQtC7teCqYSUwVGBM0NpG6T0~ocdAs2~Kn00TrPLtjo32iPwq8U3ndb9c0lRT75MMwUAZG4M5KPed--PbAYiS2UK465P-5-~DCboWpSXbbsCqzHi74BAd8kNv15-1K67dug__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoAorticArch: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/UBqhGFAUZIxSaYgz.gif?Expires=1804233217&Signature=pBsnwYkwIrnLqcz-Og27cM9NUMx6Fji0JZbDzVO~SournpTlFFOYr2TRjC0Eeo6Cvt7SroEIm3nE2hCmLBCKfr8vamp8Sk-I0r~XeMfb8jc5OOcr286gVyWIVBVNpnsYsftXuaUviZ39h~nNj-HI5lpO6SNrudOfBPPjKSs7AyRXcahyvrBS4zujQ6bbJgLdmcLgU93PlXKx6~Mo1Ox73J97ZliDqtJM-686nDaMY9LONoxDHK5FvIT7Zlz-ece3NNtmYcg1RNeMURm3u6AwVgsMEPR1YpmWrLSD1SeKDP7RciW-g9CzImYEO4jJeYDFVsOYdhqEZloqE2IDB1T8Yw__&Key-Pair-Id=K2HSFNDJXOU9YS",
  ductalArch: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/bvrodzhIwNApIBbC.png?Expires=1804217678&Signature=oZ4LyOOcoHxUHXmU-o~9dtNQd1~0O9GQRuEVBx9Bbg0NKvsBOtAhAeIBbWJJe2AJ-AlfN3N66m7sNGnvKorUkixgyqosSbhG7bnpmZoY~aFIPjDMn0Vtd0t3QrIrzmRe3JIY8frK0xo8dBhQeHI1HjKsHdHebttaz5vjkha34mBXEtFVUMPAbK-lQMeobbcZkpipsuJ1aYnIAslKeZLJwr8-d7D4LrB4oYf70rKffMyeZZ3XCLKPm19tUAktTgomn0UfIy9jCHQgjPWHMP-tNob~MMtURGRM0uzX1Vq1rsojj2pwsUYpz6haOGG1KBt1f8OU2IRLyK4oJT6aoMHsxg__&Key-Pair-Id=K2HSFNDJXOU9YS",
  echoDuctalArch: "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663401463434/niftMrorwLRVixtq.gif?Expires=1804233217&Signature=Ei2xvaGjnBEglQVKoM1GOyE5s5U-lWFu~e70vn8IbqgC398vxNhqx0TPGmBqpOT6oage7x3dNlHUw8jvDMWuSPT6ZWflKPjQqAVnGoEWKtSCtMO1bbal9ZzOaUzl3KhL1o-EJmKnZWIpId1ao5C7ClccGMjlY2u2jJXXSt~8NZd3TktyLwrnQXWDdw6N5-qTuwoHSOtw0cXPX7siTFJbJHP1YJGSjG4pH-OvboqaMezD7nNwZ6TmJG39zUzxd84arcosAEGHHlxTsU5eiIZKMqjCIPbipoaoG1ThuUBE9q5vdUa-La68F2vT5ntMZIALMIxz4Q~eUkkBkmUsel-YbA__&Key-Pair-Id=K2HSFNDJXOU9YS",
};

// ─── 13-View Fetal Echo Dataset (© All About Ultrasound, Inc. / iHeartEcho™) ──
export const FETAL_VIEWS = [
  {
    id: "abdominal-situs", step: 1, groupColor: BRAND,
    name: "Abdominal Situs View", abbr: "Situs",
    description: "The first step in fetal cardiac evaluation. Confirms normal situs solitus — stomach on left, liver on right, aorta left of spine, IVC right of spine. Situs abnormalities are strongly associated with complex congenital heart disease.",
    imageUrl: CDN.abdominalSitusDiagram,
    echoImageUrl: CDN.echoAbdominalSitus,
    structures: ["Stomach (left)", "Liver (right)", "Descending aorta (left of spine)", "IVC (right of spine)", "Umbilical vein", "Spine (posterior)"],
    normalFindings: ["Stomach bubble on LEFT side of fetus", "Aorta to LEFT of spine, IVC to RIGHT", "Liver on right, stomach on left", "Umbilical vein entering liver anteriorly"],
    technique: "Transverse view of fetal abdomen at level of stomach. Identify spine posteriorly. Confirm stomach on left and aorta/IVC positions relative to spine.",
    doppler: "Color Doppler to confirm aorta (pulsatile) vs. IVC (venous) positions relative to spine.",
    pitfalls: ["Fetal position may make left/right orientation confusing — always reference spine first", "Absent stomach may indicate esophageal atresia or diaphragmatic hernia"],
    redFlags: ["Stomach on RIGHT (situs inversus or heterotaxy)", "Stomach absent (esophageal atresia, CDH)", "Aorta and IVC on same side (asplenia/polysplenia)", "Midline stomach (heterotaxy)"],
    patientPosition: "Mother supine or left lateral tilt; obtain true transverse cardiac cut perpendicular to fetal spine",
  },
  {
    id: "4cv", step: 2, groupColor: "#1ba8b0",
    name: "Four Chamber View", abbr: "4CV",
    description: "The most important screening view in fetal echo. Obtained from a transverse cross-section of the fetal thorax at the level of the AV valves. The heart should occupy approximately 1/3 of the thoracic area.",
    imageUrl: CDN.fourChamber,
    echoImageUrl: CDN.echoFourChamber,
    structures: ["LV (left, posterior)", "RV (right, anterior)", "LA (posterior left)", "RA (posterior right)", "Mitral valve", "Tricuspid valve", "IVS", "IAS with foramen ovale flap", "Descending aorta (posterior to spine)"],
    normalFindings: ["LV and RV roughly equal in size (RV slightly larger in fetus)", "Foramen ovale flap opens toward LA", "Apex points toward left anterior chest wall (levocardia)", "Descending aorta posterior-left to spine", "Pulmonary veins entering LA (2 on each side)"],
    technique: "Transverse sweep from abdomen (situs view) cranially until 4 chambers are visible. Maintain transverse plane — do not oblique.",
    doppler: "Color Doppler across AV valves for regurgitation. PW at MV and TV tips for E/A ratio.",
    pitfalls: ["Dextrocardia vs dextroposition — check situs first", "Foramen ovale flap mistaken for ASD — flap should bow toward LA", "Oblique cut may make chambers appear unequal"],
    redFlags: ["Cardiomegaly (>1/3 thorax)", "Unequal chamber sizes", "Absent or abnormal foramen ovale flap", "Pericardial effusion", "Echogenic focus (EIF)", "Cardiac axis >60°"],
    patientPosition: "Mother supine or left lateral tilt; obtain true transverse cardiac cut perpendicular to fetal spine",
  },
  {
    id: "lvot", step: 3, groupColor: "#1db6bf",
    name: "LVOT View", abbr: "LVOT",
    description: "Obtained by rotating the transducer slightly from the 4CV to bring the LVOT into view. Confirms the aorta arises from the LV (ventriculo-arterial concordance) and crosses the RVOT.",
    imageUrl: CDN.lvot,
    echoImageUrl: CDN.echoLvot,
    structures: ["LV", "RV", "LA", "Ascending aorta (ASC AO)", "LVOT", "Pulmonary veins (entering LA)", "Descending aorta (DESC AO)"],
    normalFindings: ["Aorta arises from LV — continuity between IVS and anterior aortic wall", "Aorta crosses rightward over the RVOT", "Ascending aorta smaller than MPA in fetus", "Pulmonary veins visible entering LA posteriorly"],
    technique: "From 4CV, rotate transducer slightly clockwise (or tilt anteriorly) until the aortic root comes into view arising from the LV. The LVOT should be parallel to the ultrasound beam.",
    doppler: "PW Doppler in LVOT for velocity. Color Doppler to confirm antegrade flow from LV to aorta.",
    pitfalls: ["Overangulation brings in RVOT instead of LVOT", "Aorta appears to arise from RV in TGA — confirm with RVOT view"],
    redFlags: ["Aorta arising from RV (TGA)", "Overriding aorta (TOF)", "Aortic stenosis — turbulent LVOT flow", "Small ascending aorta (HLHS)"],
    patientPosition: "Mother supine; tilt transducer slightly cephalad from 4CV to bring LVOT into view",
  },
  {
    id: "rvot", step: 4, groupColor: "#20c4ce",
    name: "RVOT View", abbr: "RVOT",
    description: "Confirms the pulmonary artery arises from the RV. The MPA is normally larger than the ascending aorta in the fetus. The PA bifurcates into LPA and RPA.",
    imageUrl: CDN.rvot,
    echoImageUrl: CDN.echoRvot,
    structures: ["RV", "Main pulmonary artery (MPA/PA)", "Ascending aorta (ASC AO)", "Superior vena cava (SVC)", "Descending aorta (DESC AO)"],
    normalFindings: ["PA arises from RV — larger than ascending aorta in fetus", "PA bifurcates into LPA and RPA", "ASC AO and SVC visible as smaller circles to the right of PA", "DESC AO visible as small circle in lower left"],
    technique: "From LVOT view, continue rotating/tilting anteriorly until PA comes into view arising from RV. The PA should be seen bifurcating.",
    doppler: "PW Doppler in MPA for velocity. Color Doppler to confirm antegrade flow from RV to PA.",
    pitfalls: ["PA arising from LV in TGA — confirm with LVOT view", "Pulmonary stenosis — turbulent flow in MPA"],
    redFlags: ["PA arising from LV (TGA)", "Small PA (pulmonary atresia/stenosis)", "PA = Ao size (abnormal)", "Absent PA bifurcation"],
    patientPosition: "Mother supine; tilt transducer further cephalad from LVOT view to visualize RVOT crossing over aorta",
  },
  {
    id: "rvot-bifurcation", step: 5, groupColor: "#24d2d8",
    name: "RVOT with MPA Bifurcation", abbr: "MPA Bifurc",
    description: "A slightly superior view from the RVOT showing the main pulmonary artery bifurcating into the right and left pulmonary arteries. Confirms pulmonary artery anatomy and rules out pulmonary atresia.",
    imageUrl: CDN.rvotBifurcation,
    echoImageUrl: CDN.echoRvotBifurcation,
    structures: ["RV", "Main PA (MPA)", "Right PA (RPA)", "Left PA (LPA)", "Ascending aorta", "SVC"],
    normalFindings: ["MPA bifurcates into RPA and LPA", "RPA and LPA roughly equal in size", "PA bifurcation visible in same plane"],
    technique: "Slight superior tilt from RVOT view. The PA bifurcation confirms pulmonary artery anatomy and rules out pulmonary atresia.",
    doppler: "Color Doppler at bifurcation; assess RPA and LPA flow.",
    pitfalls: ["Absent bifurcation may indicate pulmonary atresia with intact IVS", "Markedly asymmetric branch PAs suggest peripheral PS or absent PA"],
    redFlags: ["Absent bifurcation (pulmonary atresia with intact IVS)", "Markedly asymmetric branch PAs", "Confluent PAs absent (severe TOF with absent PA)"],
    patientPosition: "Mother supine; slight additional cephalad tilt from RVOT view to visualize PA bifurcation into RPA and LPA",
  },
  {
    id: "3vv-ductal", step: 6, groupColor: "#28dce0",
    name: "3-Vessel View (3VV) — Ductal", abbr: "3VV",
    description: "A transverse view at the level of the great vessels showing three vessels in a line from left to right: MPA (largest), ascending aorta (medium), and SVC (smallest). The MPA bifurcates in this view.",
    imageUrl: CDN.threeVVDuctal,
    echoImageUrl: CDN.echoThreeVVDuctal,
    structures: ["MPA/Ductus Arteriosus (DA)", "Ascending aorta (ASC AO)", "SVC", "Descending aorta (DESC AO)"],
    normalFindings: ["Three vessels in a line: PA > Ao > SVC (left to right)", "PA is the largest vessel — normally larger than Ao in fetus", "Vessels align in a straight line (abnormal if offset)", "DESC AO in lower left quadrant"],
    technique: "From RVOT view, slide the transducer slightly cranially. The three vessels should appear in a transverse plane. Maintain transverse orientation.",
    doppler: "Color Doppler across all three vessels to confirm antegrade flow. PW in MPA for velocity.",
    pitfalls: ["Only 2 vessels visible — may be at wrong level", "PA and Ao equal in size — abnormal", "Vessels not in a line — offset suggests abnormality"],
    redFlags: ["PA < Ao (pulmonary stenosis/atresia)", "Absent SVC", "Vessels not in a line", "Reversed flow in PA (pulmonary atresia)"],
    patientPosition: "Mother supine; transverse upper mediastinal view — three vessels must appear in a straight line",
  },
  {
    id: "3vt", step: 7, groupColor: "#30e0e4",
    name: "3-Vessel Trachea View (3VT)", abbr: "3VT",
    description: "A transverse view at the level of the superior mediastinum showing the relationship of the three vessels to the trachea. Critical for detecting vascular rings and abnormal vessel arrangements.",
    imageUrl: CDN.threeVT,
    echoImageUrl: CDN.echoThreeVT,
    structures: ["MPA / ductal arch", "Transverse aortic arch", "SVC", "Trachea (echogenic ring)", "Descending aorta"],
    normalFindings: ["Aortic arch curves to the left of the trachea (left aortic arch)", "Three vessels form a 'V' shape pointing to the right", "Trachea is a small echogenic ring to the right of the aortic arch", "SVC is the rightmost vessel"],
    technique: "Slide cranially from 3VV until the trachea becomes visible as an echogenic ring. The aortic arch should be seen curving to the left.",
    doppler: "Color Doppler to confirm flow direction in all vessels.",
    pitfalls: ["Right aortic arch: arch curves to the right of trachea — abnormal", "Double aortic arch: vessels on both sides of trachea", "Trachea not identified — may be at wrong level"],
    redFlags: ["Right aortic arch (curves right of trachea)", "Double aortic arch", "Aberrant subclavian artery", "Vascular ring encircling trachea"],
    patientPosition: "Mother supine; transverse upper mediastinal view slightly cephalad to 3VV — trachea ring must be visible to the right of the aortic arch",
  },
  {
    id: "lbvc", step: 8, groupColor: "#38e4e8",
    name: "LBVC View", abbr: "LBVC",
    description: "A superior transverse sweep above the 3VT level showing the left brachiocephalic vein (LBVC) crossing from left to right to join the SVC. The thymus is visible anteriorly.",
    imageUrl: CDN.bcv,
    echoImageUrl: CDN.echoLbvc,
    structures: ["Left brachiocephalic vein (LBVC)", "SVC", "Thymus", "Brachiocephalic arteries", "Trachea (T)"],
    normalFindings: ["LBVC crosses midline from left to right to join SVC", "Thymus visible as gray structure anterior to vessels", "3 brachiocephalic arteries visible below LBVC", "Trachea to right side"],
    technique: "Superior transverse sweep above 3VT level. The LBVC appears as a horizontal vessel crossing from left to right, anterior to the aortic arch vessels.",
    doppler: "Color Doppler to confirm LBVC flow direction (left to right into SVC); assess thymic size.",
    pitfalls: ["Absent LBVC may drain anomalously — TAPVR, heterotaxy", "Dilated LBVC suggests increased flow — PAPVR, AVM"],
    redFlags: ["Absent LBVC (may drain anomalously — TAPVR, heterotaxy)", "Dilated LBVC (increased flow — PAPVR, AVM)", "Absent thymus (22q11 DiGeorge)", "Persistent LSVC (LBVC absent, vertical vein present instead)"],
    patientPosition: "Mother supine; transverse upper chest view just above 3VT — LBVC crosses horizontally anterior to the great vessels",
  },
  {
    id: "lv-short-axis", step: 9, groupColor: "#3de8e8",
    name: "LV Short Axis View", abbr: "LV SAX",
    description: "A transverse view at the mid-ventricular level showing the left ventricle in short axis. The LV appears circular with the RV wrapping around it anteriorly. Used to assess ventricular size, wall thickness, and systolic function.",
    imageUrl: CDN.echoLvShortAxis,
    echoImageUrl: CDN.echoLvShortAxis,
    structures: ["LV (circular)", "RV (crescent-shaped, anterior)", "Interventricular septum (IVS)", "Posterior wall", "Papillary muscles (at mid level)"],
    normalFindings: ["LV appears circular in cross-section", "RV wraps around anterior LV", "Symmetric wall thickness", "Normal papillary muscle position at mid level", "Concentric contraction on M-mode"],
    technique: "Transverse plane at mid-ventricular level. Tilt caudally from 4CV until LV appears circular with papillary muscles visible. Avoid oblique cuts that make LV appear oval.",
    doppler: "Not typically used; M-mode through LV at papillary muscle level for fractional shortening.",
    pitfalls: ["Oblique cut makes LV appear oval — foreshortens measurements", "Papillary muscles may be confused for VSD or mass", "Difficult to obtain in late gestation due to fetal position"],
    redFlags: ["Asymmetric wall thickness (hypertrophic cardiomyopathy)", "Dilated LV (cardiomyopathy, severe AR/MR)", "Echogenic foci in LV (normal variant vs. cardiac rhabdomyoma)", "Hypoplastic LV (HLHS)"],
    patientPosition: "Mother supine; transverse cardiac view at papillary muscle level — tilt inferiorly from 4CV",
  },
  {
    id: "rvot-short-axis", step: 10, groupColor: "#42e8e4",
    name: "RVOT Short Axis View", abbr: "RVOT SAX",
    description: "A transverse view at the base of the heart showing the RVOT, pulmonary valve, and main pulmonary artery with its bifurcation into RPA and LPA. Also shows the aortic root in cross-section and the ductus arteriosus.",
    imageUrl: CDN.fetalRvotSaxAnatomy,
    echoImageUrl: CDN.echoRvotShortAxis,
    structures: ["RV and RVOT", "Pulmonary valve", "MPA", "RPA and LPA", "Aortic root (circular cross-section)", "Ductus arteriosus (DA)"],
    normalFindings: ["Aortic root appears circular (AO) with PA wrapping around it", "PA bifurcates into RPA and LPA", "DA connects PA to descending aorta", "RV and RA visible", "PA diameter ≥ Ao diameter in normal fetus"],
    technique: "Transverse plane at base of heart. Tilt cranially from 3VV level. The aortic root appears as a circle with the RVOT/PA wrapping around it anteriorly — the classic 'circle and sausage' appearance.",
    doppler: "Color/PW Doppler across pulmonary valve; CW for peak velocity; assess DA flow direction.",
    pitfalls: ["PA may appear smaller than Ao if oblique — ensure true transverse cut", "DA may be confused with LPA — trace vessel to descending aorta to confirm"],
    redFlags: ["PA smaller than Ao (pulmonary stenosis/atresia, TOF)", "Absent pulmonary valve", "Reversed DA flow (critical pulmonary obstruction)", "Absent LPA or RPA"],
    patientPosition: "Mother supine; transverse upper mediastinal view — same level as 3VV, confirm PA and aortic root cross-sections",
  },
  {
    id: "bicaval", step: 11, groupColor: "#4ad9e0",
    name: "Bicaval View", abbr: "Bicaval",
    description: "A sagittal or near-sagittal view through the right side of the fetus showing both the SVC and IVC draining into the right atrium. Best view for assessing venous return and foramen ovale.",
    imageUrl: CDN.bicaval,
    echoImageUrl: CDN.echoBicaval,
    structures: ["RA", "SVC (right side)", "IVC (left side)", "LA", "Right pulmonary artery (RPA)", "Aorta (AO)"],
    normalFindings: ["SVC and IVC both drain into RA", "Foramen ovale flap visible in LA", "RPA visible in cross-section", "IVC and SVC enter RA from opposite ends"],
    technique: "Sagittal or near-sagittal plane through right side of fetus. Rotate from transverse to align with IVC/SVC axis.",
    doppler: "Color Doppler to confirm SVC and IVC flow into RA; assess foramen ovale shunting.",
    pitfalls: ["SVC absent (left SVC only — persistent LSVC)", "IVC interruption with azygos continuation (polysplenia)", "Dilated coronary sinus (persistent LSVC)"],
    redFlags: ["SVC absent (persistent LSVC only)", "IVC interruption with azygos continuation (polysplenia)", "Dilated coronary sinus (persistent LSVC)", "ASD/sinus venosus defect"],
    patientPosition: "Mother supine; sagittal or oblique view along fetal spine — align with IVC/SVC long axis entering RA",
  },
  {
    id: "aortic-arch", step: 12, groupColor: "#3ecfd6",
    name: "Aortic Arch View (Long Axis)", abbr: "Ao Arch",
    description: "A sagittal view through the left side of the fetus showing the aortic arch in long axis. The classic 'candy cane' shape confirms left aortic arch. Three head and neck vessels arise from the arch.",
    imageUrl: CDN.aorticArch,
    echoImageUrl: CDN.echoAorticArch,
    structures: ["Ascending aorta (ASC AO)", "Aortic arch", "Descending aorta (DESC AO)", "RA", "Right pulmonary artery (RPA)"],
    normalFindings: ["Candy-cane shape of aortic arch", "3 head/neck vessels arising from arch (innominate, LCCA, LSCA)", "Aortic isthmus visible between LSCA and ductus", "Left-sided arch (curves to left of trachea)"],
    technique: "Sagittal plane through left side of fetus. Align with aortic arch long axis — should see the classic candy-cane curve.",
    doppler: "CW/PW at aortic isthmus; retrograde or absent diastolic flow = coarctation/critical obstruction.",
    pitfalls: ["Ductal arch may be confused with aortic arch — ductal arch is more vertical (hockey stick)", "Only 2 head vessels visible suggests aberrant subclavian artery"],
    redFlags: ["Right aortic arch (mirror image — 22q11, TOF)", "Coarctation — narrowing at isthmus", "Interrupted aortic arch — gap in arch", "Only 2 head vessels (aberrant subclavian)"],
    patientPosition: "Mother supine; sagittal view along fetal left side — rotate transducer to align with aortic arch long axis",
  },
  {
    id: "ductal-arch", step: 13, groupColor: "#189aa1",
    name: "Long Axis Ductal Arch View", abbr: "Ductal Arch",
    description: "A sagittal view showing the ductus arteriosus connecting the pulmonary artery to the descending aorta. The ductal arch has a characteristic 'hockey stick' shape — more vertical and acute than the aortic arch.",
    imageUrl: CDN.ductalArch,
    echoImageUrl: CDN.echoDuctalArch,
    structures: ["RV", "Pulmonary valve", "Ductus Arteriosus", "Descending aorta (DESC AO)", "Aortic root (LA)"],
    normalFindings: ["Hockey-stick shape (more acute angle than aortic arch)", "Ductus connects PA directly to descending aorta", "No head/neck vessels arising from ductal arch", "RV and pulmonary valve visible at origin"],
    technique: "Sagittal plane through right side of fetus. The ductal arch is more vertical and acute than the aortic arch — hockey-stick vs. candy-cane.",
    doppler: "PW/Color Doppler in ductus; reversed or absent flow = critical right heart obstruction.",
    pitfalls: ["Ductal arch confused with aortic arch — DA is more anterior and vertical", "Absent DA may indicate pulmonary hypertension or premature closure"],
    redFlags: ["Absent ductus (isolated ductal absence — rare)", "Constricted ductus (NSAIDs, indomethacin exposure)", "Reversed ductal flow (critical pulmonary stenosis/atresia)", "Aneurysmal ductus"],
    patientPosition: "Mother supine; sagittal view along fetal right side — rotate transducer to align with ductal arch (more vertical than aortic arch)",
  },
];

export default function FetalScanCoach() {
  const [selectedView, setSelectedView] = useState(0);
  const [showBilling, setShowBilling] = useState(false);

  const { mergeView, isLoading } = useScanCoachOverrides("fetal");

  const view = useMemo(() => {
    const base = FETAL_VIEWS[selectedView];
    return mergeView ? mergeView(base as any) : base;
  }, [selectedView, mergeView]) as typeof FETAL_VIEWS[0] & { patientPosition?: string };

  const goNext = () => setSelectedView(v => Math.min(v + 1, FETAL_VIEWS.length - 1));
  const goPrev = () => setSelectedView(v => Math.max(v - 1, 0));

  return (
    <Layout>
      {/* Page header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div className="container py-8 md:py-10">
          <div className="mb-3"><BackToEchoAssist /></div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Baby className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">Fetal Echo · ScanCoach™</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                Fetal Echo ScanCoach
              </h1>
              <p className="text-white/70 mt-1 text-sm">13-view sweep sequence · All About Ultrasound, Inc.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
          {/* ─── Sidebar view list ─── */}
          <div className="lg:col-span-1 lg:order-1 order-2 lg:sticky lg:top-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Fetal Echo Views</h3>
                <p className="text-xs text-gray-400 mt-0.5">13-view sweep sequence</p>
              </div>
              {/* Sweep overview image */}
              <div className="p-2">
                <img src={CDN.sweep} alt="Fetal echo sweep overview"
                  className="w-full rounded-lg object-contain bg-gray-900" style={{ maxHeight: "100px" }} />
              </div>
              <div className="p-3 space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                {FETAL_VIEWS.map((v, i) => (
                  <button key={v.id} onClick={() => setSelectedView(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                      selectedView === i ? "text-white shadow-sm" : "hover:bg-gray-50 text-gray-700"
                    }`}
                    style={selectedView === i ? { background: v.groupColor } : {}}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                      style={{ background: selectedView === i ? "rgba(255,255,255,0.25)" : v.groupColor }}>
                      {v.step}
                    </span>
                    <span className="text-xs font-medium leading-tight">{v.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Detail panel ─── */}
          <div className="lg:col-span-3 lg:order-2 order-1 space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b" style={{ borderColor: view.groupColor + "30", background: view.groupColor + "08" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: view.groupColor }}>
                      {view.step}
                    </span>
                    <div>
                      <h2 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{view.name}</h2>
                      <span className="text-xs text-gray-400">{view.abbr}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={goPrev} disabled={selectedView === 0}
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={goNext} disabled={selectedView === FETAL_VIEWS.length - 1}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: view.groupColor }}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-gray-700 leading-relaxed">{view.description}</p>
              </div>
            </div>

            <ScanCoachViewMediaCard
              viewId={view.id}
              view={{
                ...view,
                anatomyImageUrl: (view as any).anatomyImageUrl || view.imageUrl,
              }}
            />

            {/* Structures & Normal Findings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
                  <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Structures to Identify</h3>
                </div>
                <ul className="space-y-1.5">
                  {view.structures.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: BRAND }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
                  <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Normal Findings</h3>
                </div>
                <ul className="space-y-1.5">
                  {view.normalFindings.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Technique, Patient Position, Doppler, Pitfalls */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-xs text-gray-500 mb-1 uppercase tracking-wide">Scanning Technique</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{view.technique}</p>
              </div>
              {view.patientPosition && (
                <div className="pt-3 border-t border-gray-100">
                  <h4 className="font-semibold text-xs text-gray-500 mb-1 uppercase tracking-wide">Patient Positioning</h4>
                  <p className="text-sm text-gray-600">{view.patientPosition}</p>
                </div>
              )}
              <div className="pt-3 border-t border-gray-100">
                <h4 className="font-semibold text-xs text-gray-500 mb-1 uppercase tracking-wide">Doppler</h4>
                <p className="text-sm text-gray-600">{view.doppler}</p>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <h4 className="font-semibold text-xs text-gray-500 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Common Pitfalls
                </h4>
                <ul className="space-y-1">
                  {view.pitfalls.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Red Flags */}
            <div className="bg-white rounded-xl border border-red-50 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Red Flags / Abnormal Findings</h3>
              </div>
              <ul className="space-y-1.5">
                {view.redFlags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="text-red-500 font-bold mt-0.5 flex-shrink-0">!</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Billing Codes */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f0fbfc] transition-all"
                onClick={() => setShowBilling(!showBilling)}>
                <Receipt className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
                <span className="font-bold text-sm text-gray-700 flex-1 text-left" style={{ fontFamily: "Merriweather, serif" }}>Billing Codes (CPT)</span>
                {showBilling ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showBilling && (
                <div className="border-t border-gray-100 p-5 space-y-5">
                  <p className="text-xs text-gray-400 italic">For reference only — verify with current payer policies and local coverage determinations.</p>
                  {fetalBilling.map((section, si) => (
                    <div key={si}>
                      <div className="text-xs font-bold uppercase tracking-wider text-[#189aa1] mb-2">{section.heading}</div>
                      <div className="space-y-2">
                        {section.codes.map((c, ci) => (
                          <div key={ci} className="rounded-lg border p-3" style={{ borderColor: "#189aa140", background: "#f0fbfc" }}>
                            <div className="flex items-start gap-2">
                              <span className="font-mono font-bold text-sm text-[#189aa1] flex-shrink-0">{c.code}</span>
                              <div>
                                <div className="text-sm font-medium text-gray-800">{c.description}</div>
                                {c.note && <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.note}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Copyright */}
            <div className="text-xs text-gray-400 text-center py-2">
              Clinical images © All About Ultrasound, Inc. / iHeartEcho™. Educational use only.
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

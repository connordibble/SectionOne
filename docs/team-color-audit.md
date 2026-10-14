# Team color audit — October 14, 2026

Every enabled edition has an official digital primary and secondary anchor in
`theme.brand`, with the reference URL alongside the values. The primary stage
renders the original sRGB value unchanged in both themes. UI text, chrome, raised
surfaces and field drawings use accessible derivatives; they are not claimed to
be official swatches. Secondary highlights keep their hue and adjust lightness
only when necessary for contrast.

Tennessee’s stage had been reduced to L55 to carry white type, making it look
like burnt orange. Its official #FF8200 now keeps its original lightness, with
dark stage text. Texas keeps #BF5700. The same shared rule handles every team.

| Edition | Stage primary | Secondary | Official reference |
| --- | --- | --- | --- |
| Texas | #BF5700 | #FFFFFF | [Color reference](https://umac.utexas.edu/brand-center/colors/) |
| Utah State | #00263A | #FFFFFF | [Color reference](https://www.usu.edu/brand/standards/logos/sub-brands/files/USU_Athletics_VIG.pdf) |
| Ohio State | #BA0C2F | #A7B1B7 | [Color reference](https://bux.osu.edu/color/primary-colors/) |
| LSU | #461D7C | #FDD023 | [Color reference](https://www.lsu.edu/communications/files/brand-guide.pdf) |
| Northwestern | #4E2A84 | #FFFFFF | [Color reference](https://www.northwestern.edu/brand/visual-identity/color-palettes/) |
| Kansas | #0051BA | #E8000D | [Color reference](https://brand.ku.edu/guidelines/design/color) |
| Alabama | #9E1B32 | #FFFFFF | [Color reference](https://brand.ua.edu/colors/) |
| Georgia | #BA0C2F | #000000 | [Color reference](https://brand.uga.edu/visual-identity/visual-style/) |
| Notre Dame | #0C2340 | #AE9142 | [Color reference](https://onmessage.nd.edu/university-branding/colors/) |
| Michigan | #00274C | #FFCB05 | [Color reference](https://cm.engin.umich.edu/our-brand/colors/) |
| Penn State | #001E44 | #FFFFFF | [Color reference](https://brand.psu.edu/design-toolkit/design-essentials) |
| Miami | #005030 | #F47321 | [Color reference](https://www.alumni.miami.edu/_assets/pdf/connect/groups/us-canes-communities/group-leader-resources/canes_community_communication_style_guidelines_2024.pdf) |
| Tennessee | #FF8200 | #FFFFFF | [Color reference](https://brand.utk.edu/standards/colors/) |
| BYU | #003DA5 | #FFFFFF | [Color reference](https://sclcenter.byu.edu/00000194-9448-d81b-a9be-954e73ad0001/marketing-and-style-guide-logo-color-palette) |
| Texas Tech | #E90802 | #000000 | [Color reference](https://www.ttu.edu/brand/visual-identity/) |
| Indiana | #990000 | #EDEBEB | [Color reference](https://iuhoosiers.com/documents/download/2018/8/28/IUB_athletics_brandguide_TO_PRESS_8_2.pdf) |
| Boise State | #0033A0 | #D64309 | [Color reference](https://broncosports.com/documents/download/2026/4/16/Boise_State_Athletics_Brand_Standards_RGB_2026.pdf) |
| James Madison | #450084 | #CBB677 | [Color reference](https://www.jmu.edu/identity/our-style/color.shtml) |
| App State | #010101 | #FFCC00 | [Color reference](https://uc.appstate.edu/brand-identity-guide/identity-guide/colors) |
| Fresno State | #C41230 | #13284C | [Color reference](https://marcomm.fresnostate.edu/color.html) |

Use published **web hex** values where a guide’s RGB or CMYK equivalents disagree.
Utah State uses the athletics guide’s Aggie Blue; BYU keeps its approved royal
blue; App State uses its published near-black digital value. Indiana’s athletics
guide supplies crimson and cream. Notre Dame uses the university’s digital gold.
Boise State’s 2026 athletics guide confirms the university blue and orange.

The audit corrected approximate anchors for Utah State, Northwestern, Kansas,
Alabama and Georgia; reduced stage saturation/lightness for Miami, Tennessee and
Texas Tech; Penn State’s anchor to the current brand book’s digital hex; and App
State’s gray stage to its published black. It also removed invented secondary
tints from Miami and Boise State and updated Fresno’s secondary to official blue.
Existing exact anchors are now stored directly, with source provenance.

Verification holds the full contrast bar: 4.5:1 for body text, 3:1 for display
figures and meaningful field routes, with additional focus and chrome checks.
Browser tests compare all twenty rendered stage colors to their official sRGB
anchors in both themes (at most one channel value of rounding error).

Release validation: `pnpm check` passed with 566 tests. The production build and
306 Playwright checks passed, including all twenty stage colors, native team
navigation, and compact schedule separation at eleven widths in both themes.
Visual review covered 160 edition states and 28 homepage closed/open picker
states. Social cards were rebuilt from the corrected palettes. Tokenlock passed.

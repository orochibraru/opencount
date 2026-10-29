# Changelog

## 1.0.0 (2026-10-29)

### Features

* setup code framed in hashtags and an OpenCount logo in the boot log ([ad5f0cd](https://github.com/orochibraru/opencount/commit/ad5f0cd426d1ec48c63d667a94e9c58e657c0f50))
* second factor after Google, email link or code, passkey on the two-step page, source link in the footer ([719babc](https://github.com/orochibraru/opencount/commit/719babc4829b46973a8fb757c5bce03deb0230e7))
* Finance counted apart from spending everywhere, tap a personal line to see its details ([921d3dd](https://github.com/orochibraru/opencount/commit/921d3dd12834b13505aac37ef4a076d270caa0a3))
* admin banner and bank sync switch, merchant filter, filters in Insights, fuzzy search ([d7ba6f2](https://github.com/orochibraru/opencount/commit/d7ba6f24f9e42fee8054d5ae367d6b8c8ae70fb3))
* internal transfers, shared and savings accounts, balances and income in Insights, account renaming, Travel category, full-bleed PWA icons ([6d29fc3](https://github.com/orochibraru/opencount/commit/6d29fc337cf9a5f70726a580b27941b4d15cc807))
* internal transfers, shared and savings accounts, income and balances in Insights; full-bleed PWA icons ([bb13cd5](https://github.com/orochibraru/opencount/commit/bb13cd5c8c4fa20170a8f294d4cb8fddcaf931be))
* MCP tools for merchants and new categories, Friends & family category, full bank history with live sync status, bank filter pills and bank sync tabs, pay-to-pay month start ([fb11e65](https://github.com/orochibraru/opencount/commit/fb11e65ce228eefeda286b7e83cf31e459d06e43))
* MCP tools for merchants and new categories, Friends & family category, full bank history with live sync status and bank filter pills, pay-to-pay month start ([a25f205](https://github.com/orochibraru/opencount/commit/a25f2052d87cee75b8b6b5950ff3d5ee26ae625a))
* let AI apps categorize shared group expenses over MCP and serve OAuth discovery at the root for Gemini ([87bc128](https://github.com/orochibraru/opencount/commit/87bc12801efe5ce7f96e8adde0a31ecd8e4b6228))
* Home tab, folder filter and move, notes on personal expenses, Taxes & fines category, AI apps over MCP with OAuth and a 30-day re-sign-in, plus redirectTo kept through sign-in and a styled fallback error page ([9d0e336](https://github.com/orochibraru/opencount/commit/9d0e336d199a9da15ce6849da6c9d60f581e53f1))
* **security:** app lock passcode, request-wide factor gate, guarded admin loads, hardened better-auth, pinned public origin (#1) ([79980e4](https://github.com/orochibraru/opencount/commit/79980e47b530510f082336be4c927bcb52af6ee6))
* personal money overview, income and set-aside tracking, personal categories, filters and insights, plus security hardening ([360a3b7](https://github.com/orochibraru/opencount/commit/360a3b74d985372c9eb5646766abb32af3d54f3d))
* flags on countries and logos on banks when linking a bank ([38fda34](https://github.com/orochibraru/opencount/commit/38fda347b7d70f8ff4f0a1c3efd6a09b65eb272d))
* offer the install on every phone browser, not on desktop ([5fb7485](https://github.com/orochibraru/opencount/commit/5fb7485519183d9f03d1936b39ffcba6f32ed178))
* rename yourself in a group, i18n on the backlog ([10aa1ca](https://github.com/orochibraru/opencount/commit/10aa1caa1af1fee436c7c70d2898deb5f822d9f7))
* per-account bank sync, personal folders, search, paging, category colours, smarter categorizing and faster group pages ([4ea68b3](https://github.com/orochibraru/opencount/commit/4ea68b36b8a4e24bffc1d2cf51be82f98ef62074))
* password reset, account and admin tools, backups, invite links, Tricount import, exports, currencies, offline capture and Docker Hub README sync ([2e2a564](https://github.com/orochibraru/opencount/commit/2e2a5643ca07e091aa1f2a53ba1c96f94350b69e))
* email sign-in, push notifications, install prompt, opaque drawers and integration and e2e suites ([84b20ea](https://github.com/orochibraru/opencount/commit/84b20eab133b4d7e60db5e4435f8c5e9d1aa50fb))
* desktop shell, group settings tabs, recurring expenses, insights, receipts, docs and Docker Hub publishing ([86fdcf1](https://github.com/orochibraru/opencount/commit/86fdcf1d29b6a645c6b381cb943e023ec5f470ab))
* base ([b076c90](https://github.com/orochibraru/opencount/commit/b076c9085c91208c4c5ee42c4e23e16383cf076c))

### Bug Fixes

* shared expense split follows the edited amount, even exact splits open as equal ([8ed7eb5](https://github.com/orochibraru/opencount/commit/8ed7eb5b383bd20f5c95c7d460ddc6b6f8cbbb8f))
* trusted devices skip the two-step check for every sign-in method and passkeys, year on past pay-month ranges ([1f79b05](https://github.com/orochibraru/opencount/commit/1f79b05852b617b2ff08253fa187fdec13e6787f))
* absolute resolve() paths, SIGN_IN_METHODS override, SSO callback refusal and sign-in error page, tab titles, MCP folder tools ([2652a38](https://github.com/orochibraru/opencount/commit/2652a386d7c5d39674be07ee93dfb64d1378e81d))
* daily bank sync at 06:00 UTC, relink for full history, scrollable desktop sheets ([eb99294](https://github.com/orochibraru/opencount/commit/eb99294e2cb2810c3c7e85a756e48b0b2dbde135))
* relink banks without duplicates, refuse unreadable links, typed Enable Banking client ([8928c0e](https://github.com/orochibraru/opencount/commit/8928c0eaab1cb311d1ef97d33bd5a47030bb0216))
* per-account bank sync report, refuse links that share no readable account ([dc98526](https://github.com/orochibraru/opencount/commit/dc98526fede2a5ffc3786f3597c276303a38dbe4))
* stop the required-factor redirect from looping on the security page ([714b866](https://github.com/orochibraru/opencount/commit/714b8669207a36e4758906da2a92dd163dc3df18))
* allow the bank link and OIDC sign-in to redirect off-site ([0cef9e8](https://github.com/orochibraru/opencount/commit/0cef9e8b6d146cd8fed8d2a5e35649f0eafbf8af))
* show phone toasts under the app bar, larger ([5e257d6](https://github.com/orochibraru/opencount/commit/5e257d67a7472e7b211d5513baa9edcabba6f792))
* link the web app manifest so the PWA can be installed ([3c75cb7](https://github.com/orochibraru/opencount/commit/3c75cb76b78cdf521e6e68ff58df669e829e0d2a))
* move the personal page helper out of the routes folder ([d17bc19](https://github.com/orochibraru/opencount/commit/d17bc193f15b7d6afa3dfa2ebff32cdc9576ebb9))

### Code Refactoring

* turn server libraries into singleton classes grouped by domain folder ([7052476](https://github.com/orochibraru/opencount/commit/70524765ec3366b68fb173bc587e7f10020378ff))
* move route-local components into lib/components ([2523d5b](https://github.com/orochibraru/opencount/commit/2523d5b01611a267374f0e62efeb51fb2754994e))

# TODO

The only backlog. Each entry is a `- [ ]` checkbox: put `**[WIP]**` after the
box while it's being worked on, and delete the entry once it's done.

## Medium

- [ ] Adding someone to a group by email adds their account without asking them
      and tells the adder whether an account uses that email: turn it into an
      invite they accept.
- [ ] PDF export still prints CJK and emoji as `?`: Noto Sans covers Latin,
      Greek and Cyrillic only. Noto Sans CJK adds about 16 MB per weight to the
      image, and pdf-lib can't draw colour emoji.
- [ ] Bank sync asks each person to create an Enable Banking application and
      link their own accounts in its control panel: walk them through it with
      screenshots, or add a second provider.

- [ ] A `script-src` CSP: the appearance boot script is inline `{@html}` in the
      root layout, so it needs a nonce or a hash before `script-src 'self'` can
      go in `kit.csp`, and `img-src` has to allow the banks' logo hosts.
- [ ] Group members see each other's email in the members list, including people
      who joined through an invite link: show it only to the member themselves,
      or drop it, together with the add-by-email invite above.
- [ ] Unlock with a passkey (Face ID, fingerprint) as well as the passcode.
- [ ] Sign-in is rate limited per email, so anyone can keep an account's form
      sign-in locked for 15 minutes at a time: key it on email and client
      address, which needs `ADDRESS_HEADER` behind a proxy.

## Large

- [ ] Translate the app: every string through a message catalog, French first
      next to English, the language picked per account (Appearance) and falling
      back to the browser's, emails and push notifications included.

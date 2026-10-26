# Sign-in and single sign-on

**Admin, Sign-in methods** decides how people get in: email and password,
passkeys, and any number of OpenID Connect providers. Password and passkey
sign-in are on by default; there is no provider until you add one.

## Methods

- **Email and password**: the classic. Passwords need at least 12 characters,
  three of lowercase, uppercase, digit and symbol, and must not contain the name
  part of the email.
- **Passkeys**: Face ID, Touch ID, Windows Hello or a security key, registered
  from **Account, Security**. Browsers only offer them over HTTPS (or on
  `localhost`).

An admin can turn either off. Turned off means refused on the server, not only
hidden: the sign-in endpoints answer 403 whatever calls them.

Two rules keep the instance reachable:

- At least one way to sign in stays on: passwords, passkeys, or an enabled
  provider.
- The admin turning a method off must still have a way in afterwards: a passkey,
  or an account already linked to an enabled provider. Otherwise the change is
  refused with what to do first.

With passwords off, anyone who has neither a passkey nor a linked provider is
sent to **Account, Security** on their next page load to add a passkey while
their session still lets them.

## Two-factor

An account with an authenticator app is asked for its 6-digit code after the
password, or for one of its backup codes. **Trust this device for 30 days**
skips the code on that browser for a month. Admins can make an authenticator
app, a passkey, or both mandatory from **Admin, Access**; see
[The admin area](admin).

## Single sign-on

Any OpenID Connect provider works: Authentik, Authelia, Keycloak, Zitadel,
Google, Microsoft Entra ID and so on. Add one with:

- **Name on the button**, like _Authentik_. It also makes the provider's id in
  the redirect URI: lowercase, accents dropped, anything else turned into
  dashes.
- **Discovery URL**, usually ending in `/.well-known/openid-configuration`.
  OpenCount fetches it when you save and refuses a URL that isn't a discovery
  document.
- **Client ID** and **Client secret**. The secret is stored encrypted and never
  shown again; leave it empty when editing to keep it.
- **Show it on the sign-in page**: whether the provider is enabled.

Register the **redirect URI** the page shows with the provider, of the form:

```text
https://opencount.example.com/api/auth/callback/<id>
```

It is built from `ORIGIN` when set, otherwise from the address you opened the
admin page with. OpenCount asks for the `openid`, `email` and `profile` scopes,
with PKCE.

### Who gets in

- **Someone with an account**: signing in with a provider that returns the same
  email links the provider to their account, and they can use either from then
  on.
- **Someone without an account**: the provider creates one only while sign-ups
  are open. With sign-ups closed, invite them first; they can then sign in with
  the provider.

### Turning a provider off

Its button leaves the sign-in page and its callback is refused. Accounts that
used it keep their other ways in. Deleting the last enabled way to sign in is
refused, like turning the last method off.

## When someone is locked out

There is no recovery flow yet: no password reset by email, and an admin can't
reset someone else's authenticator app. The way back is an admin deleting the
account from **Admin, Users** and inviting the person again. Their members in
groups stay as plain names with their expenses: once someone adds the new
account back to a group by email, they claim their old name with **That's me**.

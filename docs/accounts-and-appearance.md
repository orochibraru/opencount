# Your account

**Account** holds five sections: profile, security, appearance, notifications
and bank sync. Signing out is at the bottom of it.

## Profile

Your name, as other members see it when they link you to a group, up to 80
characters.

**Email** is the one you sign in with. To change it, type the new address: a
6-digit code goes to it, valid 15 minutes, and the change happens once you enter
it. The old address gets a notice that the account moved. It needs email
delivery, and an address another account uses is refused. An admin can also
change it from [the admin area](admin).

**Delete account** removes your sign-in, sessions and security keys, and asks
for your password when you have one (otherwise a recent sign-in). In your
groups, your member stays as a plain name with its expenses, so nobody's balance
changes. The last admin can't delete their account: make someone else admin
first.

## Security

- **Password**: change it by typing the current one and a new one twice. An
  account with no password yet (it signs in with a passkey, a provider or an
  email code) can set one here. Changing it signs your other devices out.
- **Authenticator app**: confirm your password, scan the QR code with any app
  that makes 6-digit codes (or type the key), and enter a code to finish. Keep
  the backup codes it shows: each one signs you in once if you lose the device.
  At sign-in you can trust the device for 30 days.
- **Passkeys**: Face ID, Touch ID, Windows Hello or a security key. Add as many
  as you like and remove the ones you no longer use. With passkey sign-in on, a
  passkey replaces your email and password at sign-in.

- **App lock**: a 6-digit passcode, typed twice, that locks OpenCount after 1,
  5, 15 or 60 minutes away (5 by default). It is checked on the server for each
  session, so closing the tab or reloading doesn't get around it: a locked
  session shows the unlock page and nothing else. The app also locks itself when
  you come back after the delay, and clears the pages it kept for offline use.
  Five wrong passcodes sign that session out. If you forget it, sign out and
  sign in again; a session signed in within the last 15 minutes can change or
  remove the passcode without the old one. Setting a passcode locks your other
  devices.
- **Signed-in devices**: every session of your account, with a button to sign
  one out or all the others.

Some changes ask for a recent sign-in, within 15 minutes: adding or removing a
passkey, setting a first password, starting an email change, deleting an account
with no password, and saving or removing bank sync keys. Otherwise you are told
to sign out and back in. Changing your email or setting a password signs your
other devices out.

An admin can require an authenticator app, a passkey or an app lock. Until you
add what is required, every page, form and request sends you here, with a note
saying what is missing. The same happens when an admin turns password sign-in
off and you have no other way in: add a passkey, and you are through. See
[Sign-in and single sign-on](sign-in-and-sso).

## Appearance

Stored on your account, so it follows you to every device, and applied before
the page paints, so a reload never flashes the wrong theme.

| Setting   | Choices                                                                     |
| --------- | --------------------------------------------------------------------------- |
| Accent    | Bordeaux (default), Green, Blue, Violet, Rose, Orange, Amber, Cyan, Neutral |
| Theme     | System (default), Light, Dark                                               |
| Dark mode | Dim (default), AMOLED black                                                 |
| Font      | Geist and Sora (default), System, Serif, Mono                               |
| Corners   | Rounded (default), Square                                                   |

Every colour in the app derives from the accent, so the whole interface shifts
with it. AMOLED black turns dark backgrounds pure black, which saves battery on
OLED phones.

## Notifications

**Account, Notifications** turns notifications on for the device you're on: the
browser asks for permission, then OpenCount tells you when someone else adds an
expense in one of your groups. Tapping one opens that group. Each phone or
computer is turned on separately and listed under **Your devices**, where you
can remove any of them; **Send a test** checks the one you're on. On iPhone and
iPad, Apple only allows notifications in the installed app, so add it to the
home screen first.

## Bank sync

**Account, Bank sync** is where you set up your own Enable Banking application
for [bank sync](personal-and-banks). Nobody else can see or use your keys.

## On a phone

After you sign in on a phone or tablet, OpenCount offers to install itself, once
per device: Chrome, Edge and Samsung Internet show their install dialog, iPhone
and iPad browsers explain **Share, Add to Home Screen**, and other browsers
point to **Install app** in their menu. On a computer, install it from the
address bar. You can also do it yourself any time. Installed, it opens
standalone, like a native app, with pull to refresh on every page and a light
tap of haptics on actions. An expense added with no connection is kept on the
device and sent once you're back online. Pages you already opened reopen with no
connection; one you never opened shows an offline screen, and signing out clears
what was kept, the waiting expenses included. Waiting expenses are only sent for
the account that made them. The bottom tab bar holds Groups, Personal and
Account, plus Admin for admins. On a desktop, a sidebar lists Groups, Personal,
Admin and your groups, with your account in the menu under your name at the
bottom.

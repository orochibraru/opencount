# Email

OpenCount sends these emails: invites, sign-up verification codes, password
reset links, the code that confirms a new address and the notice to the old one,
sign-in links and codes, and a test message. It sends them through an SMTP
server you configure in **Admin, Email**; there is no built-in mail service and
no third party.

Email is optional. Without it, invites still work as links you send yourself,
but sign-ups stay closed: they confirm each address with a code sent by email.
Password reset and changing your own email need it too: without it, an admin
changes an address, and someone who forgot their password asks an admin.

## Settings

| Field        | What it is                                                         |
| ------------ | ------------------------------------------------------------------ |
| Host         | The SMTP server's host name, like `smtp.example.com`               |
| Port         | Usually 465 for TLS, 587 for STARTTLS                              |
| Encryption   | TLS (port 465), STARTTLS (port 587), or None                       |
| Username     | Optional; leave empty for a server that doesn't authenticate       |
| Password     | Stored encrypted; leave empty when editing to keep the current one |
| From address | The sender address recipients see                                  |
| From name    | The sender name recipients see                                     |

STARTTLS is required when picked: a server that doesn't offer it is refused,
rather than falling back to plain text. **None** sends in clear, which only
makes sense to a relay on the same machine or network.

The password is encrypted with a key derived from `AUTH_SECRET` before it is
stored, and never sent back to the browser. Change `AUTH_SECRET` and you have to
enter it again.

## Testing

**Send me a test email** queues a message to your own address. Check your inbox;
if nothing arrives within a minute, the error is on **Admin, Overview** under
the failed jobs.

## How it is sent

A request never waits on the SMTP server. Each email is a background job: the
page answers straight away and the worker delivers the message, trying up to
five times with growing delays when the server refuses or times out. A message
that still fails shows up on **Admin, Overview** with the server's error.

Connections time out after 15 seconds, and a stalled transfer after 30.

## Removing it

**Remove email settings** deletes the SMTP settings and closes sign-ups in the
same step, since they can't work without email. Pending invites keep working as
links.

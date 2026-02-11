# Majik Message

**Majik Message** is a browser extension for **encrypting and decrypting text directly in your browser**. It is **not a chat platform** — it does not host conversations or store messages on a server. Instead, it allows you to securely encrypt text, share it with contacts, and decrypt it on any webpage, giving you full control over your data.



---

- [Majik Message](#majik-message)
  - [Features](#features)
  - [Usage](#usage)
    - [Encrypt Text](#encrypt-text)
    - [Decrypt Text](#decrypt-text)
    - [Account Management](#account-management)
  - [Architecture](#architecture)
    - [Browser Extension](#browser-extension)
    - [Encryption](#encryption)
    - [Contacts \& Accounts](#contacts--accounts)
    - [Scanner](#scanner)
  - [How to Use Majik Message](#how-to-use-majik-message)
    - [1. Creating an Account](#1-creating-an-account)
    - [2. Encrypting Messages (Manual / Side Panel)](#2-encrypting-messages-manual--side-panel)
    - [3. Encrypting Text Inside a Web Page](#3-encrypting-text-inside-a-web-page)
    - [4. Decrypting Messages](#4-decrypting-messages)
      - [Decrypt an Entire Page](#decrypt-an-entire-page)
      - [Decrypt a Selected Text](#decrypt-a-selected-text)
    - [5. Automatic Scanning and Decryption](#5-automatic-scanning-and-decryption)
    - [6. Sharing Your Account (Invite Key)](#6-sharing-your-account-invite-key)
    - [7. Adding Contacts](#7-adding-contacts)
    - [8. Importing an Existing Account](#8-importing-an-existing-account)
    - [Notes and Security Reminders](#notes-and-security-reminders)
  - [Contributing](#contributing)
  - [License](#license)
  - [Author](#author)
  - [About the Developer](#about-the-developer)
  - [Contact](#contact)


---

## Features

- **Text Encryption Anywhere**  
  - Highlight any text on a webpage (e.g., Gmail, Facebook), right-click, and select **Encrypt** to generate a secure string. Only authorized contacts can decrypt it.  

- **Local Account with Seed Phrase**  
  - Accounts are derived from a **seed phrase** — no registration required.  
  - Add multiple contacts who can decrypt your messages.  
  - Share your account via **invite key** for collaborative access.  
  - Save, export, and import your account as a **JSON file** or **backup key**.  

- **Page-Wide Decryption**  
  - Decrypt all valid encrypted strings on a page in a single action.  

- **Automatic Scanner**  
  - Enable the scanner in settings to automatically detect and decrypt valid encrypted text on any webpage in real-time.  

- **Privacy-First Design**  
  - All encryption and decryption occur locally. Messages are never stored on a server unless explicitly saved by the user.  

---

## Usage

### Encrypt Text

- Highlight text → right-click → Encrypt.
- Replace the text with an encrypted string or copy it.

### Decrypt Text

- Highlight encrypted string → right-click → Decrypt
- Decrypt the entire page → right-click → Decrypt Page
- Or enable the scanner to auto-detect and decrypt strings on a page

### Account Management

- Create an account from a seed phrase.
- Add contacts or share your account via an invite key.
- Export/import your account via JSON or backup key.

---

## Architecture

### Browser Extension
Injects a content script for detecting and modifying page text.

### Encryption
Uses standard cryptographic algorithms (AES, RSA or other implemented schemes) for end-to-end encryption.

### Contacts & Accounts
Local storage using browser storage APIs (optional JSON backup).

### Scanner
Observes DOM mutations to detect and auto-decrypt valid encrypted strings.

---
## How to Use Majik Message

### 1. Creating an Account

Majik Message uses **seed-based accounts**. No email or registration is required.

1. Open the **Side Panel**.
2. A **seed phrase** will be automatically generated.
   - You may regenerate a new seed phrase at any time by clicking the **dice icon**.
3. Enter a **display name**.
   - If left empty, your public key address will be used by default.
4. Enter a **password**, then click **Apply** to create the account.
5. Upon creation, a **JSON backup file** will be downloaded automatically.
   - **Important:** Keep this file secure and private.  
     Anyone with access to this backup can open your account and decrypt your messages.

Once the account is created, it becomes the active account for encryption and decryption.

---

### 2. Encrypting Messages (Manual / Side Panel)

You can encrypt text directly from the Side Panel without interacting with a webpage.

1. Open the **Side Panel**.
2. Go to the **Message** tab.
3. Toggle the mode to **Encrypt**.
4. Choose recipients:
   - Encrypt for **yourself only**, or
   - Add one or more **contacts** so they can decrypt the same message.
5. Enter your text into the input box.
6. Choose an output option:
   - Copy encrypted text to clipboard
   - Download as a `.txt` file
   - Download as a `.json` file

---

### 3. Encrypting Text Inside a Web Page

You can encrypt text directly inside any webpage (e.g., Gmail, Facebook).

1. Open a page with a text editor (e.g., Gmail compose, Facebook post).
2. Write or compose your message normally.
3. Highlight the text you want to encrypt.
   - You can press **Ctrl + A** to select all text.
4. Right-click to open the context menu.
5. Select **Majik Message → Encrypt**.
6. Choose:
   - Encrypt for yourself, or
   - Encrypt for a specific contact.

The selected text will be replaced with an encrypted string.

---

### 4. Decrypting Messages

#### Decrypt an Entire Page

1. Right-click anywhere on the page.
2. Select **Majik Message → Decrypt Page**.
3. All valid encrypted strings on the page will be decrypted.
   - Decryption only works if the **active account** has access to the message.

---

#### Decrypt a Selected Text

1. Highlight the encrypted text.
2. Right-click to open the context menu.
3. Select **Majik Message → Decrypt**.

---

### 5. Automatic Scanning and Decryption

Majik Message can automatically detect and decrypt encrypted content on any page.

1. Open the **Side Panel**.
2. Go to the **Scanner** tab.
3. Enable **Scan**.
4. Enter your account password when prompted.

Once enabled:
- Any page you load (e.g., Gmail, Facebook) will be scanned.
- If encrypted content valid for your active account is detected, it will be decrypted automatically.

---

### 6. Sharing Your Account (Invite Key)

You can allow others to encrypt messages for you by sharing your invite key.

1. Open the **Side Panel**.
2. Go to the **Accounts** tab.
3. Hover over your account.
4. Click the **Share** icon.
5. Copy and share your **invite key**.

Others can use this key to add you as a contact.

---

### 7. Adding Contacts

To decrypt messages from others or allow shared encryption:

1. Open the **Side Panel**.
2. Go to the **Contacts** tab.
3. Click the **Add Friend** icon.
4. Paste the other user’s **invite key**.

The contact will be added to your directory.

---

### 8. Importing an Existing Account

You can restore an account using a previously saved backup.

1. Open the **Side Panel**.
2. Go to the **Accounts** tab.
3. Choose **Import Account**.
4. Select your saved **JSON backup file**.
5. Enter the associated password.

The account will be restored and can be set as active.

---

### Notes and Security Reminders

- All encryption and decryption are performed locally in your browser.
- Majik Message does not store messages or host conversations.
- Backup files and seed phrases grant full access to an account—store them securely.
- Decryption depends on the currently active account.

---

## Contributing

If you want to contribute or help extend support to more platforms, reach out via email. All contributions are welcome!  

---

## License

[Apache-2.0](LICENSE) — free for personal and commercial use.

---
## Author

Made with 💙 by [@thezelijah](https://github.com/jedlsf)

## About the Developer

- **Developer**: Josef Elijah Fabian
- **GitHub**: [https://github.com/jedlsf](https://github.com/jedlsf)
- **Project Repository**: [https://github.com/jedlsf/majik-message](https://github.com/jedlsf/majik-message)

---

## Contact

- **Business Email**: [business@thezelijah.world](mailto:business@thezelijah.world)
- **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)

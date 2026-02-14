# [Majik Message](https://message.majikah.solutions)

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)


**Majik Message** is a secure messaging platform built on cryptographic identity. Your account *is* your encryption keys—no phone numbers, no passwords, just your 12-word seed phrase and complete privacy.

![npm](https://img.shields.io/npm/v/@majikah/majik-message) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-message) ![npm bundle size](https://img.shields.io/bundlephobia/min/%40majikah%2Fmajik-message) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)



[Read more about Majik Message here](https://majikah.solutions/products/majik-message)

[![Majik Message Thumbnail](https://storage.majikah.solutions/public/Majikah_MajikMessage_SocialCard.webp)](https://message.majikah.solutions)

> Click the image to try Majik Message live.

[Read Docs](https://majikah.solutions/products/majik-message/docs)


[![Majik Message Microsoft App Store](https://get.microsoft.com/images/en-us%20light.svg)](https://apps.microsoft.com/detail/9pmjgvzzjspn)


Also available on [Microsoft Store](https://apps.microsoft.com/detail/9pmjgvzzjspn) for free.


[![Majik Message Google Chrome Web Store](https://developer.chrome.com/static/docs/webstore/branding/image/UV4C4ybeBTsZt43U4xis.png)](https://chromewebstore.google.com/detail/dhlafmkpgjagkhiokoighjaakajbckck)


Also available on [Google Chrome Web Store](https://chromewebstore.google.com/detail/dhlafmkpgjagkhiokoighjaakajbckck) for free.


---

- [Majik Message](#majik-message)
  - [Overview](#overview)
    - [What Makes Majik Message Different](#what-makes-majik-message-different)
  - [Key Features](#key-features)
    - [End-to-End Encryption](#end-to-end-encryption)
    - [Seed Phrase–Based Identity](#seed-phrasebased-identity)
    - [Offline Operation](#offline-operation)
    - [Realtime Messaging (Free for Everyone)](#realtime-messaging-free-for-everyone)
    - [Group Messaging](#group-messaging)
    - [Persistent Message Threads](#persistent-message-threads)
    - [Message Expiration Timer](#message-expiration-timer)
    - [Encrypted Message Export](#encrypted-message-export)
    - [Solo Messages for Personal Storage](#solo-messages-for-personal-storage)
    - [Multi-Account Support](#multi-account-support)
    - [Chrome Extension](#chrome-extension)
  - [How It Works](#how-it-works)
    - [Account Creation](#account-creation)
    - [Sending an Encrypted Message](#sending-an-encrypted-message)
      - [For Solo Messages (sender-only):](#for-solo-messages-sender-only)
      - [For Group Messages (2+ recipients):](#for-group-messages-2-recipients)
    - [Receiving and Decrypting a Message](#receiving-and-decrypting-a-message)
    - [Thread Message Integrity](#thread-message-integrity)
  - [Platform Availability](#platform-availability)
    - [Desktop App](#desktop-app)
    - [Web App](#web-app)
    - [Browser Extension](#browser-extension)
    - [Coming Soon](#coming-soon)
  - [Getting Started](#getting-started)
    - [1. Download and Install](#1-download-and-install)
    - [2. Create Your Account](#2-create-your-account)
    - [3. Backup Your Account](#3-backup-your-account)
    - [4. Register for Realtime Messaging (Optional)](#4-register-for-realtime-messaging-optional)
    - [5. Add Contacts](#5-add-contacts)
    - [6. Start Messaging](#6-start-messaging)
  - [Usage Guide](#usage-guide)
    - [Desktop App / Web App](#desktop-app--web-app)
      - [Creating an Account](#creating-an-account)
      - [Encrypting Messages](#encrypting-messages)
      - [Decrypting Messages](#decrypting-messages)
      - [Managing Accounts](#managing-accounts)
      - [Threads (Persistent Messaging)](#threads-persistent-messaging)
        - [Creating a Thread](#creating-a-thread)
        - [Adding Messages to a Thread](#adding-messages-to-a-thread)
        - [Managing Threads](#managing-threads)
        - [Threads Validation:](#threads-validation)
    - [Chrome Extension](#chrome-extension-1)
      - [Encrypting Text on Any Webpage](#encrypting-text-on-any-webpage)
      - [Decrypting Text on Any Webpage](#decrypting-text-on-any-webpage)
      - [Automatic Scanning](#automatic-scanning)
  - [Technical Specifications](#technical-specifications)
    - [Cryptography Stack](#cryptography-stack)
    - [Platform \& Infrastructure](#platform--infrastructure)
    - [Messaging Capabilities](#messaging-capabilities)
  - [Security](#security)
    - [What Majik Message Protects](#what-majik-message-protects)
    - [What Users Must Protect](#what-users-must-protect)
    - [What Majik Message Does Not Protect](#what-majik-message-does-not-protect)
  - [Roadmap](#roadmap)
  - [Use Cases](#use-cases)
    - [Privacy-Conscious Individuals](#privacy-conscious-individuals)
    - [Journalists](#journalists)
    - [Professionals Handling Sensitive Data](#professionals-handling-sensitive-data)
    - [Security Researchers and Developers](#security-researchers-and-developers)
    - [Anyone Seeking Digital Autonomy](#anyone-seeking-digital-autonomy)
  - [Pricing](#pricing)
  - [Part of the Majikah Ecosystem](#part-of-the-majikah-ecosystem)
  - [Related Projects](#related-projects)
    - [Majik Key](#majik-key)
  - [Contributing](#contributing)
  - [License](#license)
  - [Author](#author)
  - [About the Developer](#about-the-developer)
  - [Contact](#contact)


---

## Overview

Majik Message replaces traditional username and password accounts with **cryptographic identity**. Messages are encrypted end-to-end using Ed25519 and X25519 elliptic curve cryptography, ensuring only recipients with the correct private keys can decrypt them.

Whether online or offline, you maintain full control over your encrypted communications—without relying on centralized infrastructure, personal information, or trusted intermediaries.

### What Makes Majik Message Different

- **True End-to-End Encryption**: Military-grade encryption using Ed25519 and X25519
- **Seed Phrase Identity**: No email or phone number required—your 12-word seed phrase is your account
- **Works Offline**: Encrypt and decrypt messages without internet connection
- **No Permanent Storage**: Messages automatically expire and are never permanently stored on servers
- **Multi-Platform**: Desktop app, web app, and Chrome extension


## Key Features

### End-to-End Encryption

Majik Message uses proven elliptic curve cryptography:

- **Ed25519**: Generates and manages your cryptographic identity
- **X25519 (Curve25519)**: Handles secure key exchange and message encryption
- **AES-256-GCM**: Encrypts message content with authenticated encryption

Every message is encrypted on your device before transmission and can only be decrypted by the intended recipient. Not even Majik Message servers can access your message content.

### Seed Phrase–Based Identity

Your account is a 12-word BIP39 mnemonic seed phrase—the same standard used by cryptocurrency wallets:

- Each seed phrase deterministically generates an Ed25519 keypair
- Your public key serves as your account identity and fingerprint
- Your private key never leaves your device and is never transmitted
- No email, phone number, or personal information required

As long as you have your 12 words, you can recover full access to your identity and decrypt your messages—anywhere, anytime.

### Offline Operation

Majik Message doesn't require constant connectivity:

- **Encrypt messages offline**: Generate encrypted messages without internet access
- **Decrypt messages offline**: Read previously received messages anytime
- **Verify identities independently**: Confirm contact fingerprints using cryptographic verification

This makes Majik Message ideal for high-security environments, air-gapped systems, or situations where network access is restricted.

### Realtime Messaging (Free for Everyone)

When online, Majik Message provides instant encrypted messaging:

- WebSocket-based realtime delivery
- Messages stored temporarily in Redis with automatic expiration (24 hours default, expandable to 30 days)
- Typing indicators and read receipts for active conversations
- Messages automatically expire and are permanently deleted from servers

### Group Messaging

Secure group conversations with up to 25 participants:

- Each message is individually encrypted for every group member
- Same security guarantees as one-on-one messaging
- Typing indicators and read receipts work in group chats

### Persistent Message Threads

Cryptographic hash-chain history for important conversations:

- Immutable message records with cryptographic integrity
- Each message cryptographically linked to the previous (blockchain-style)
- Tamper-resistant conversation history
- Messages cannot be edited or deleted individually
- Thread validation tool to verify message integrity
- Perfect for contracts, formal communications, and audit trails

### Message Expiration Timer

Set custom expiration times for sensitive conversations. Messages automatically delete after the specified duration, reducing your digital footprint.

### Encrypted Message Export

Messages can be exported as encrypted Base64 strings:

- Download and archive encrypted messages locally
- Share encrypted content through any channel (email, file storage, etc.)
- Messages remain fully encrypted outside the platform

### Solo Messages for Personal Storage

Encrypt messages where you are the only recipient—perfect for private notes and journals:

- Sender-only encryption for personal storage and archival
- Works entirely offline in local mode (Message tab)
- Perfect for encrypted journals, notes, passwords, or sensitive information
- Export as encrypted Base64 strings for backup or transfer

### Multi-Account Support

Manage multiple cryptographic identities for different contexts:

| Account Type | Local Storage     | Online Registration |
| ------------ | ----------------- | ------------------- |
| Free Users   | Up to 25 accounts | 5 accounts          |
| Paid Users   | Up to 25 accounts | 10 accounts         |

**What this means:**
- **Local accounts** can encrypt and decrypt messages offline but cannot send/receive realtime messages
- **Registered accounts** have full access to realtime messaging, typing indicators, and online features
- You can swap which accounts are registered online at any time

### Chrome Extension

Available on the Google Chrome Web Store:

- Browser-based encryption and decryption
- DOM scanning: Automatically detect encrypted messages on any webpage and decrypt them inline
- Offline-only operation: Designed for local encryption/decryption workflows

---

## How It Works

### Account Creation

When you create a Majik Message account:

1. A 12-word BIP39 mnemonic seed phrase is generated using cryptographically secure random number generation
2. The seed phrase deterministically generates an Ed25519 keypair
3. The Ed25519 keys are converted to X25519 (Curve25519) keys for encryption
4. Your public key is hashed (SHA-256) to create your account fingerprint
5. Your private key is encrypted with a passphrase (PBKDF2-SHA256, 250k iterations) and stored locally in IndexedDB

**Critical security note:** Your seed phrase and private key never leave your device. The passphrase you set protects your encrypted private key in local storage.

### Sending an Encrypted Message

#### For Solo Messages (sender-only):

1. An ephemeral X25519 keypair is generated for this message only
2. A shared secret is computed using your ephemeral private key and your own public key (ECDH)
3. The shared secret is hashed (SHA-256) to derive a 256-bit AES key
4. Your message is encrypted with AES-256-GCM using the derived key and a random 12-byte IV
5. The encrypted message, IV, and ephemeral public key are packaged and stored locally

#### For Group Messages (2+ recipients):

1. A random 256-bit AES key is generated for the message
2. The message is encrypted once with AES-256-GCM
3. An ephemeral X25519 keypair is generated
4. The AES key is individually encrypted for each recipient using X25519 shared secrets

This ensures only authorized recipients can decrypt the message, and the ephemeral key prevents long-term compromise.

### Receiving and Decrypting a Message

1. Your device retrieves the encrypted payload from the server or extracts it from the DOM (browser extension)
2. The message fingerprint identifies which of your accounts should decrypt it
3. Your private key is unlocked by decrypting it with your passphrase
4. A shared secret is computed using your private key and the sender's ephemeral public key
5. The AES key is derived from the shared secret (SHA-256)
6. The message is decrypted using AES-256-GCM with the derived key and the provided IV

If decryption fails (due to tampering or incorrect keys), an authentication error is thrown and the message is rejected.

### Thread Message Integrity

Threads use blockchain-style message chaining:

1. Each message is encrypted using the same end-to-end encryption as regular messages
2. A cryptographic hash is computed from the message content
3. This hash is linked to the hash of the previous message in the thread
4. The chain of hashes creates an immutable, verifiable history
5. Any tampering breaks the hash chain and is immediately detectable
6. Downloaded thread logs can be independently verified at any time

---

## Platform Availability

### Desktop App
- **Windows**: Microsoft Store or GitHub Releases
- **macOS**: GitHub Releases
- **Linux**: GitHub Releases

### Web App
- Access at: [https://message.majikah.solutions](https://message.majikah.solutions)

### Browser Extension
- **Chrome**: [Chrome Web Store](https://chromewebstore.google.com/detail/majik-message/dhlafmkpgjagkhiokoighjaakajbckck)

### Coming Soon
- iOS app
- Android app

---

## Getting Started

### 1. Download and Install

Choose your platform:

- **Desktop (Windows)**: [Microsoft Store](https://apps.microsoft.com/detail/9PMJGVZZJSPN) or [GitHub Releases](https://github.com/Majikah/majik-message/releases)
- **Web App**: [message.majikah.solutions](https://message.majikah.solutions)
- **Chrome Extension**: [Chrome Web Store](https://chromewebstore.google.com/detail/majik-message/dhlafmkpgjagkhiokoighjaakajbckck)

### 2. Create Your Account

1. Launch Majik Message
2. A 12-word seed phrase will be automatically generated
   - You may regenerate a new seed phrase at any time by clicking the dice icon
3. Enter a display name (optional - your public key address will be used by default if left empty)
4. Enter a strong password, then click **Apply** to create the account
5. Upon creation, a JSON backup file will be downloaded automatically
   - **Important:** Keep this file secure and private. Anyone with access to this backup can open your account and decrypt your messages.

### 3. Backup Your Account

- Your backup file downloads automatically upon account creation
- Store it securely offline
- This is the ONLY way to recover your account if needed

### 4. Register for Realtime Messaging (Optional)

To use realtime chat features:

**From the Accounts tab:**
- Hover over an account and click 'Register Online' in the action menu

**From the Majikah tab:**
- Find 'Registered Identities' section and click the Plus (+) icon to register an existing local account

**Note:** Registration is only needed for realtime chat. Local encryption/decryption works without registration.

### 5. Add Contacts

1. Open the Side Panel
2. Go to the **Contacts** tab
3. Click the **Add Friend** icon
4. Paste the other user's invite key

Or share your own invite key:
1. Go to the **Accounts** tab
2. Hover over your account
3. Click the **Share** icon
4. Copy and share your invite key

### 6. Start Messaging

- **For realtime chat**: Use the 'Chats' tab (requires at least 2 participants including yourself)
- **For local encryption**: Use the 'Message' tab to encrypt messages offline and share through any channel
- **Pro tip**: You can encrypt solo messages (only yourself as recipient) for personal storage like journals or notes—available only in local mode

---

## Usage Guide

### Desktop App / Web App

#### Creating an Account

1. Open Majik Message
2. A seed phrase will be automatically generated (click the dice icon to regenerate)
3. Enter a display name and password
4. Click **Apply** to create the account
5. Save the downloaded JSON backup file securely

#### Encrypting Messages

**In the Message Tab (Local Mode):**
1. Toggle mode to **Encrypt**
2. Choose recipients (yourself only, or add contacts)
3. Enter your text
4. Choose output: Copy to clipboard, download as .txt, or download as .json

**In Realtime Chat:**
1. Select a conversation or create a new one
2. Type your message
3. Click send - the message is automatically encrypted before transmission

#### Decrypting Messages

**In the Message Tab:**
1. Toggle mode to **Decrypt**
2. Paste the encrypted text
3. View the decrypted message

**In Realtime Chat:**
- Messages are automatically decrypted when received

#### Managing Accounts

- **Switch accounts**: Click on any account in the Accounts tab
- **Register online**: Hover over account → Register Online
- **Share invite key**: Hover over account → Share icon
- **Export backup**: Hover over account → Export
- **Import account**: Accounts tab → Import Account button

#### Threads (Persistent Messaging)

##### Creating a Thread

1. Navigate to the **Threads** tab in the top navigation
2. Click the **plus (+) icon** (New Thread button)
3. Select participants from your contact directory
   - All participants must be registered online
   - Participants cannot be changed after creation
4. Optionally set a thread topic/subject
5. Click **Create**

##### Adding Messages to a Thread

1. Open the thread from the Threads tab
2. Click the **plus (+) icon** in the Thread Viewer
3. Enter an optional subject and your message content
4. Click **Send** to add to the thread
   - Messages are encrypted and permanently stored
   - Messages cannot be edited or deleted after sending

##### Managing Threads

**Rename Thread Topic:**
- Any participant can rename the thread at any time
- Click the **pencil/edit icon** in Thread Viewer
- Enter new topic and click **Apply Changes**

**Close Thread (Owner Only):**
- Click the **check icon** in Thread Viewer
- Choose whether to auto-delete after closing
- Closed threads cannot accept new messages

**Request Deletion:**
- Any participant can request thread deletion
- Requires approval from all participants
- Owner can delete immediately by closing with auto-delete enabled
- All participants receive encrypted backup before deletion

**Verify Thread Integrity:**
- Visit [https://message.majikah.solutions/threads/validate](https://message.majikah.solutions/threads/validate)
- Import downloaded thread log JSON file
- System validates blockchain hash chain
- Tampered messages are detected and flagged

##### Threads Validation: 
[https://message.majikah.solutions/threads/validate](https://message.majikah.solutions/threads/validate)

### Chrome Extension

#### Encrypting Text on Any Webpage

1. Highlight the text you want to encrypt
2. Right-click to open the context menu
3. Select **Majik Message → Encrypt**
4. Choose to encrypt for yourself or a specific contact

The selected text will be replaced with an encrypted string.

#### Decrypting Text on Any Webpage

**Decrypt Selected Text:**
1. Highlight the encrypted text
2. Right-click → **Majik Message → Decrypt**

**Decrypt Entire Page:**
1. Right-click anywhere on the page
2. Select **Majik Message → Decrypt Page**

All valid encrypted strings on the page will be decrypted.

#### Automatic Scanning

Enable automatic detection and decryption:

1. Open the Side Panel
2. Go to the **Scanner** tab
3. Enable **Scan**
4. Enter your account password when prompted

Once enabled, any page you load will be automatically scanned for encrypted content.


---

## Technical Specifications

### Cryptography Stack

| Component                   | Implementation                              |
| --------------------------- | ------------------------------------------- |
| Identity Generation         | Ed25519 (EdDSA on Curve25519)               |
| Key Exchange                | X25519 (ECDH on Curve25519)                 |
| Symmetric Encryption        | AES-256-GCM (authenticated encryption)      |
| Hash Function               | SHA-256                                     |
| Key Derivation (Passphrase) | PBKDF2-SHA256 (250,000 iterations)          |
| Key Derivation (Mnemonic)   | PBKDF2-SHA256 (200,000 iterations)          |
| Mnemonic Standard           | BIP39 (12-word seed phrases)                |
| Random Number Generation    | Browser crypto.getRandomValues (CSPRNG)     |
| Fingerprint                 | SHA-256 hash of public key (Base64-encoded) |

All cryptographic operations use the **@stablelib** library suite for consistent, auditable implementations across platforms.

### Platform & Infrastructure

| Component          | Technology                                   |
| ------------------ | -------------------------------------------- |
| Realtime Messaging | WebSocket                                    |
| Message Storage    | Redis with TTL (24h default, max 30 days)    |
| Data Persistence   | No permanent server-side storage             |
| Local Storage      | IndexedDB (encrypted private keys, contacts) |
| Desktop App        | Microsoft Store, GitHub Releases             |
| Browser Extension  | Google Chrome (Chrome Web Store)             |

**Important:** Messages are automatically deleted from Redis after expiration. Majik Message servers never retain message content permanently and cannot decrypt messages even during temporary storage.

### Messaging Capabilities

| Feature            | Status                     |
| ------------------ | -------------------------- |
| Text Messages      | ✓ Supported                |
| Persistent Threads | ✓ Blockchain-style-hashing |
| Group Chats        | ✓ Up to 25 participants    |
| Typing Indicators  | ✓ Supported                |
| Read Receipts      | ✓ Supported                |
| Message Expiration | ✓ Custom timers available  |
| File/Image Sharing | ⧗ Coming soon              |

---

## Security

### What Majik Message Protects

- **Message content**: End-to-end encrypted with AES-256-GCM
- **Identity privacy**: No phone numbers or email addresses required
- **Private keys**: Never transmitted; encrypted at rest with PBKDF2-derived passphrase
- **Forward secrecy**: Ephemeral keys ensure past messages remain secure even if current keys are compromised
- **Message integrity**: Thread messages use blockchain-style chaining to detect tampering
- **Audit trails**: Downloadable, verifiable thread histories for compliance and records

### What Users Must Protect

- **Your 12-word seed phrase**: This is the ONLY way to recover your account. If lost, your account and messages are permanently inaccessible. Store it securely offline.
- **Your passphrase**: Protects your locally stored private key. Choose a strong, unique passphrase.
- **Device security**: If your device is compromised while your account is unlocked, an attacker could access your private keys.

### What Majik Message Does Not Protect

- **Metadata**: Timing, message frequency, and participant relationships may be visible to servers or network observers
- **IP addresses**: Your IP address is visible to Majik Message servers when you connect for realtime messaging
- **Device compromise**: If malware or an attacker gains access to your unlocked device, they may access decrypted messages or private keys

---

## Roadmap

Majik Message is under active development. Planned features include:

- **File and image sharing** (Coming soon): Send encrypted files and images directly through Majik Message
- **Voice messages** (Coming soon): Encrypted audio recording and playback
- **Mobile apps** (Planned): Native iOS and Android applications
- **Paid tiers** (Coming soon): Subscription and pay-as-you-go options with increased account limits and extended message retention

---

## Use Cases

### Privacy-Conscious Individuals
If you want secure messaging without linking your phone number or email address, Majik Message provides true anonymity.

### Journalists
Communicate with sources securely. The offline encryption capability allows you to exchange encrypted messages through air-gapped systems.

### Professionals Handling Sensitive Data
Lawyers, healthcare providers, researchers, and other professionals can communicate confidentially without relying on third-party platforms.

### Security Researchers and Developers
Majik Message's cryptographic implementation is transparent and uses well-audited libraries (@stablelib).

### Anyone Seeking Digital Autonomy
If you believe your communications should be private by default and you want full control over your identity and data, Majik Message is designed for you.

---

## Pricing

Majik Message is currently **free for all users**. Realtime messaging, encryption, and all core features are available at no cost.

**Coming soon:** Paid subscription and pay-as-you-go models with expanded account limits and additional features will be available in the future.

---

## Part of the Majikah Ecosystem

Majik Message is a flagship product within the Majikah system—a suite of privacy-focused, user-controlled tools designed to give individuals full ownership of their digital communications and data.

All Majikah products share the same core principles: cryptographic identity, zero-knowledge architecture, and user sovereignty over personal information.

---

## Related Projects

### [Majik Key](https://majikah.solutions/sdk/majik-key)
**Majik Key** is a seed phrase account library for creating, managing, and parsing mnemonic-based cryptographic accounts (Majik Keys). Generate deterministic key pairs from BIP39 seed phrases with simple, developer-friendly APIs.

![npm](https://img.shields.io/npm/v/@majikah/majik-key) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-key) ![npm bundle size](https://img.shields.io/bundlephobia/min/%40majikah%2Fmajik-key) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

[Read Docs](https://majikah.solutions/sdk/majik-key/docs)
[Official Repository](https://github.com/Majikah/majik-key)
[SDK Library](https://www.npmjs.com/package/@majikah/majik-key)

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
- **Project Repository**: [https://github.com/Majikah/majik-message](https://github.com/Majikah/majik-message)

---

## Contact

- **Business Email**: [business@thezelijah.world](mailto:business@thezelijah.world)
- **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)

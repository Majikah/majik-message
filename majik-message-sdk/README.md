# [Majik Message](https://message.majikah.solutions)

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18996348.svg)](https://doi.org/10.5281/zenodo.18996348)
[![Static Badge](https://img.shields.io/badge/IANA-vnd.majikah.bundle-green)](https://www.iana.org/assignments/media-types/application/vnd.majikah.bundle)



**Majik Message** is a post-quantum secure messaging platform built on cryptographic identity. Your account *is* your encryption keys—no phone numbers, no passwords, just your 12-word seed phrase and complete privacy. Safe from quantum computers.

![npm](https://img.shields.io/npm/v/@majikah/majik-message) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-message) ![npm bundle size](https://img.shields.io/bundlephobia/min/%40majikah%2Fmajik-message) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)



[Read more about Majik Message here](https://majikah.solutions/products/majik-message)

[![Majik Message Thumbnail](https://github.com/user-attachments/assets/d433c6b8-1841-4fa1-a6da-b348029d1dbe)](https://message.majikah.solutions)

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
    - [Post-Quantum End-to-End Encryption](#post-quantum-end-to-end-encryption)
    - [Seed Phrase–Based Hybrid Identity](#seed-phrasebased-hybrid-identity)
    - [Offline Operation](#offline-operation)
    - [Realtime Messaging (Free for Everyone)](#realtime-messaging-free-for-everyone)
    - [Group Messaging](#group-messaging)
    - [Emoji and GIF Support](#emoji-and-gif-support)
    - [Persistent Message Threads](#persistent-message-threads)
    - [Message Expiration Timer](#message-expiration-timer)
    - [Encrypted Message Export](#encrypted-message-export)
    - [Solo Messages for Personal Storage](#solo-messages-for-personal-storage)
    - [Multi-Account Support](#multi-account-support)
    - [Chrome Extension](#chrome-extension)
  - [How It Works](#how-it-works)
    - [Account Creation (Hybrid Keypair Derivation)](#account-creation-hybrid-keypair-derivation)
    - [Sending a Post-Quantum Encrypted Message](#sending-a-post-quantum-encrypted-message)
      - [For Solo Messages (sender-only):](#for-solo-messages-sender-only)
      - [For Group Messages (2+ recipients):](#for-group-messages-2-recipients)
    - [Receiving and Decrypting a Post-Quantum Message](#receiving-and-decrypting-a-post-quantum-message)
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
    - [Post-Quantum Cryptography Stack](#post-quantum-cryptography-stack)
    - [Hybrid Key Derivation](#hybrid-key-derivation)
    - [Envelope Format v3 (ML-KEM Only)](#envelope-format-v3-ml-kem-only)
    - [Platform \& Infrastructure](#platform--infrastructure)
    - [Messaging Capabilities](#messaging-capabilities)
  - [Security](#security)
    - [What Majik Message Protects](#what-majik-message-protects)
    - [What Users Must Protect](#what-users-must-protect)
    - [What Majik Message Does Not Protect](#what-majik-message-does-not-protect)
    - [Post-Quantum Security Guarantees](#post-quantum-security-guarantees)
  - [Roadmap](#roadmap)
  - [Use Cases](#use-cases)
    - [Privacy-Conscious Individuals](#privacy-conscious-individuals)
    - [Future-Proof Security for High-Value Communications](#future-proof-security-for-high-value-communications)
    - [Journalists](#journalists)
    - [Professionals Handling Sensitive Data](#professionals-handling-sensitive-data)
    - [Security Researchers and Cryptography Professionals](#security-researchers-and-cryptography-professionals)
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

Majik Message replaces traditional username and password accounts with **cryptographic identity**. Messages are encrypted end-to-end using **ML-KEM-768 (FIPS-203)** post-quantum key encapsulation combined with X25519 for identity and AES-256-GCM for content encryption, ensuring your messages remain secure even against future quantum computers.

Whether online or offline, you maintain full control over your encrypted communications—without relying on centralized infrastructure, personal information, or trusted intermediaries.

### What Makes Majik Message Different

- **Post-Quantum Encryption**: NIST-standardized ML-KEM-768 (FIPS-203) + X25519 + AES-256-GCM
- **Seed Phrase Identity**: No email or phone number required—your 12-word seed phrase generates both X25519 and ML-KEM-768 keypairs
- **Works Offline**: Encrypt and decrypt quantum-safe messages without internet connection
- **Argon2id KDF**: Modern memory-hard key derivation (64 MB, 3 iterations) resistant to GPU/ASIC attacks
- **No Permanent Storage**: Messages automatically expire and are never permanently stored on servers
- **Multi-Platform**: Desktop app, web app, and Chrome extension


## Key Features

### Post-Quantum End-to-End Encryption

Majik Message uses NIST-standardized post-quantum cryptography combined with proven elliptic curve algorithms:

- **ML-KEM-768 (FIPS-203)**: Post-quantum key encapsulation mechanism based on lattice cryptography—secure against quantum computer attacks
- **X25519 (Curve25519)**: Generates your unique fingerprint and provides backward compatibility
- **AES-256-GCM**: Encrypts message content with authenticated encryption and tamper detection
- **Argon2id**: Modern memory-hard key derivation (64 MB memory, 4 threads, 3 iterations) resistant to GPU/ASIC cracking

Every message is encrypted on your device with post-quantum algorithms before transmission and can only be decrypted by the intended recipient. Not even Majik Message servers can access your message content—and neither can a quantum computer.

**What this means for you:** The encryption protecting your messages today will remain secure even when quantum computers become powerful enough to break traditional encryption methods like RSA and standard elliptic curves.

### Seed Phrase–Based Hybrid Identity

Your account is a 12-word BIP39 mnemonic seed phrase—the same standard used by cryptocurrency wallets. From this single phrase, two keypairs are derived:

- **X25519 keypair** (from seed[0..32]): Provides your unique fingerprint and account ID for identity verification
- **ML-KEM-768 keypair** (from full seed[0..64]): Handles post-quantum message encryption (1184-byte public key, 2400-byte secret key)
- Both keypairs are deterministically generated—same seed phrase always produces the same keys
- Your private keys never leave your device and are never transmitted
- No email, phone number, or personal information required

As long as you have your 12 words, you can recover full access to your identity and decrypt your messages—anywhere, anytime.

**Automatic Upgrade:** Old accounts are automatically upgraded to post-quantum security when you import your backup. The mnemonic deterministically regenerates both X25519 and ML-KEM-768 keys, and Argon2id re-encrypts them with modern KDF.

### Offline Operation

Majik Message doesn't require constant connectivity:

- **Encrypt messages offline**: Generate quantum-safe encrypted messages without internet access
- **Decrypt messages offline**: Read previously received messages anytime
- **Verify identities independently**: Confirm contact fingerprints using cryptographic verification

This makes Majik Message ideal for high-security environments, air-gapped systems, or situations where network access is restricted.

### Realtime Messaging (Free for Everyone)

When online, Majik Message provides instant post-quantum encrypted messaging:

- WebSocket-based realtime delivery with quantum-safe encryption
- Messages stored temporarily in Redis with automatic expiration (24 hours default, expandable to 30 days)
- Typing indicators and read receipts for active conversations
- Messages automatically expire and are permanently deleted from servers

### Group Messaging

Secure group conversations with up to 25 participants:

- Each message is individually encrypted using ML-KEM-768 key encapsulation for every group member
- Same post-quantum security guarantees as one-on-one messaging
- Typing indicators and read receipts work in group chats

**How group encryption works:** A single random AES-256 key encrypts the message once. This key is then individually sealed for each recipient using ML-KEM-768 encapsulation—only the holder of the matching ML-KEM secret key can decrypt their copy.

### Emoji and GIF Support

Express yourself with rich media while maintaining post-quantum security:

- Native emoji picker for quick reactions
- GIPHY integration for searching and sending GIFs
- Encrypted transmission (GIF URLs and emoji encrypted with ML-KEM-768)
- Works in realtime chat (individual and group conversations)

### Persistent Message Threads

Cryptographic hash-chain history for important conversations with post-quantum encryption:

- Immutable message records with cryptographic integrity
- Each message cryptographically linked to the previous (blockchain-style)
- All thread messages use ML-KEM-768 encryption—safe from quantum computer attacks
- Tamper-resistant conversation history
- Messages cannot be edited or deleted individually
- Thread validation tool to verify message integrity
- Perfect for contracts, formal communications, and audit trails

### Message Expiration Timer

Set custom expiration times for sensitive conversations. Messages automatically delete after the specified duration, reducing your digital footprint.

### Encrypted Message Export

Messages can be exported as quantum-safe encrypted Base64 strings:

- Download and archive quantum-safe encrypted messages locally
- Share encrypted content through any channel (email, file storage, etc.)
- Messages remain fully post-quantum encrypted outside the platform

Your archived messages will remain safe even when quantum computers become mainstream.

### Solo Messages for Personal Storage

Encrypt messages where you are the only recipient—perfect for private notes and journals:

- Sender-only encryption for personal storage and archival
- Works entirely offline in local mode (Message tab)
- Perfect for encrypted journals, notes, passwords, or sensitive information
- Export as quantum-safe encrypted Base64 strings for backup or transfer
- Uses the same ML-KEM-768 post-quantum encryption as group messages

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

- Browser-based post-quantum encryption and decryption
- DOM scanning: Automatically detect encrypted messages on any webpage and decrypt them inline
- Offline-only operation: Designed for local encryption/decryption workflows with ML-KEM-768 security

---

## How It Works

### Account Creation (Hybrid Keypair Derivation)

When you create a Majik Message account:

1. A 12-word BIP39 mnemonic seed phrase is generated using cryptographically secure random number generation (CSPRNG)
2. The mnemonic is converted to a 64-byte seed via BIP39 PBKDF2-SHA512
3. Two keypairs are deterministically derived from this seed:
   - **X25519 keypair**: seed[0..32] → Ed25519 → X25519 via ed2curve (used for fingerprint & identity)
   - **ML-KEM-768 keypair**: seed[0..64] → ml_kem768.keygen() (used for post-quantum message encryption)
4. Your X25519 public key is hashed (SHA-256) to create your account fingerprint
5. Both private keys are encrypted with your passphrase using Argon2id (64 MB memory, 4 threads, 3 iterations) and stored locally in IndexedDB

**Critical security note:** Your seed phrase and private keys never leave your device. The passphrase you set protects your Argon2id-encrypted private keys in local storage. Old accounts are automatically upgraded to Argon2id + ML-KEM when you import your backup—the mnemonic deterministically regenerates all keys.

### Sending a Post-Quantum Encrypted Message

#### For Solo Messages (sender-only):

1. ML-KEM-768 encapsulation is performed on your own ML-KEM public key
2. This generates a 32-byte shared secret + 1088-byte ciphertext
3. The 32-byte shared secret is used directly as the AES-256-GCM key
4. Your message is encrypted with AES-256-GCM using the shared secret and a random 12-byte IV
5. The encrypted message, IV, and ML-KEM ciphertext are packaged into a v3 envelope and stored locally

**Quantum-safe:** Even with a quantum computer, an attacker cannot decrypt this message without your ML-KEM secret key.

#### For Group Messages (2+ recipients):

1. A random 32-byte AES key is generated for the message
2. The message is encrypted once with AES-256-GCM using this key
3. For each recipient: ML-KEM-768 encapsulation generates a 32-byte shared secret
4. The group AES key is XORed with the shared secret (one-time pad): `encryptedAesKey = aesKey XOR mlKemSharedSecret`
5. Each recipient gets their own 1088-byte ML-KEM ciphertext and encryptedAesKey in the envelope

This ensures only authorized recipients can decrypt the message—and the ML-KEM encapsulation prevents quantum computer attacks.

### Receiving and Decrypting a Post-Quantum Message

1. Your device retrieves the v3 encrypted envelope from the server or extracts it from the DOM (browser extension)
2. The message fingerprint identifies which of your accounts should decrypt it
3. Your private keys are unlocked by decrypting them with your passphrase via Argon2id
4. For solo messages: Your ML-KEM-768 secret key decapsulates the 1088-byte ciphertext, recovering the 32-byte shared secret
5. For group messages: Your ML-KEM secret key decapsulates your ciphertext, then the shared secret is XORed with your encryptedAesKey to recover the group AES key
6. The message is decrypted using AES-256-GCM with the recovered key and the provided IV

**Quantum-safe decryption:** ML-KEM decapsulation never throws on the wrong key—it returns garbage, which causes AES-GCM authentication to fail. If decryption fails (due to tampering, incorrect keys, or quantum attack attempts), an authentication error is thrown and the message is rejected.

### Thread Message Integrity

Threads use blockchain-style message chaining with post-quantum encryption:

1. Each message is encrypted with ML-KEM-768 v3 envelope format (post-quantum secure)
2. A cryptographic hash (SHA-256) is computed from the message content
3. This hash is linked to the hash of the previous message in the thread
4. The chain of hashes creates an immutable, verifiable history
5. Any tampering breaks the hash chain and is immediately detectable
6. Downloaded thread logs can be independently verified at any time
7. The underlying encryption uses ML-KEM-768, so archived threads remain secure against quantum computers

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
   - Your backup is encrypted with Argon2id and can fully restore both X25519 and ML-KEM-768 keypairs

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

**Note:** Contacts registered after the ML-KEM upgrade will automatically have both X25519 and ML-KEM-768 public keys in their contact cards.

### 6. Start Messaging

- **For realtime chat**: Use the 'Chats' tab (requires at least 2 participants including yourself)—all messages use ML-KEM-768 encryption
- **For local encryption**: Use the 'Message' tab to encrypt quantum-safe messages offline and share through any channel
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
6. Both X25519 and ML-KEM-768 keypairs are automatically derived from your seed

#### Encrypting Messages

**In the Message Tab (Local Mode):**
1. Toggle mode to **Encrypt**
2. Choose recipients (yourself only, or add contacts)
3. Enter your text
4. Choose output: Copy to clipboard, download as .txt, or download as .json
5. All messages use ML-KEM-768 post-quantum encryption

**In Realtime Chat:**
1. Select a conversation or create a new one
2. Type your message (emoji and GIF support available)
3. Click send - the message is automatically encrypted with ML-KEM-768 before transmission

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
- **Share invite key**: Hover over account → Share icon (includes both X25519 and ML-KEM-768 public keys)
- **Export backup**: Hover over account → Export
- **Import account**: Accounts tab → Import Account button (automatically upgrades old accounts to Argon2id + ML-KEM-768)

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
   - Messages are encrypted with ML-KEM-768 and permanently stored
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
- All participants receive quantum-safe encrypted backup before deletion

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

The selected text will be replaced with a quantum-safe encrypted string.

#### Decrypting Text on Any Webpage

**Decrypt Selected Text:**
1. Highlight the encrypted text
2. Right-click → **Majik Message → Decrypt**

**Decrypt Entire Page:**
1. Right-click anywhere on the page
2. Select **Majik Message → Decrypt Page**

All valid ML-KEM-768 encrypted strings on the page will be decrypted.

#### Automatic Scanning

Enable automatic detection and decryption:

1. Open the Side Panel
2. Go to the **Scanner** tab
3. Enable **Scan**
4. Enter your account password when prompted

Once enabled, any page you load will be automatically scanned for quantum-safe encrypted content.


---

## Technical Specifications

### Post-Quantum Cryptography Stack

| Component                        | Implementation                                      |
| -------------------------------- | --------------------------------------------------- |
| Post-Quantum Key Encapsulation   | ML-KEM-768 (FIPS-203, NIST standardized)            |
| Identity Fingerprint             | X25519 (Curve25519) public key                      |
| Symmetric Encryption             | AES-256-GCM (authenticated encryption)              |
| Hash Function                    | SHA-256                                             |
| Key Derivation (Passphrase)      | Argon2id (64 MB memory, 4 threads, 3 iterations)    |
| Key Derivation (Mnemonic)        | Argon2id (32 MB memory, 4 threads, 3 iterations)    |
| Mnemonic Standard                | BIP39 (12-word seed phrases)                        |
| Random Number Generation         | Browser crypto.getRandomValues (CSPRNG)             |
| Fingerprint                      | SHA-256 hash of X25519 public key (Base64-encoded) |
| ML-KEM Key Sizes                 | Public: 1184 bytes, Secret: 2400 bytes, Ciphertext: 1088 bytes |

**Post-quantum security:** ML-KEM-768 (Module-Lattice-Based Key Encapsulation Mechanism) is a NIST-standardized algorithm (FIPS-203) based on lattice cryptography. It provides security against both classical and quantum computer attacks. All cryptographic operations use the **@stablelib** library suite and **@noble/post-quantum** for consistent, auditable implementations across platforms.

### Hybrid Key Derivation

| Seed Slice   | Derivation                      | Purpose                              |
| ------------ | ------------------------------- | ------------------------------------ |
| seed[0..32]  | Ed25519 → X25519 via ed2curve   | Account fingerprint & identity       |
| seed[0..64]  | ML-KEM-768 keygen               | Post-quantum message encryption      |

**How it works:** A 12-word BIP39 mnemonic generates a 64-byte seed. The first 32 bytes derive an Ed25519 keypair (converted to X25519 for encryption), which provides your fingerprint. The full 64 bytes derive an ML-KEM-768 keypair for post-quantum message encryption. Both keypairs are deterministic—same mnemonic always produces the same keys.

### Envelope Format v3 (ML-KEM Only)

| Format           | Structure                                                                |
| ---------------- | ------------------------------------------------------------------------ |
| Binary envelope  | [1-byte version=3][32-byte fingerprint][JSON payload]                    |
| Solo payload     | { iv, ciphertext, mlKemCipherText }                                      |
| Group payload    | { iv, ciphertext, keys: [{ fingerprint, mlKemCipherText, encryptedAesKey }] } |
| Scanner string   | ~*$MJKMSG:<base64 of binary envelope>                                    |

**v3 envelope (current):** Uses ML-KEM-768 key encapsulation exclusively. Legacy v1/v2 envelopes (X25519 ephemeral key exchange) have been fully deprecated. Solo messages use the ML-KEM shared secret directly as the AES key. Group messages use a random AES key sealed per-recipient via ML-KEM encapsulation (aesKey XOR mlKemSharedSecret one-time-pad construction).

### Platform & Infrastructure

| Component          | Technology                                          |
| ------------------ | --------------------------------------------------- |
| Realtime Messaging | WebSocket (quantum-safe encrypted)                  |
| Message Storage    | Redis with TTL (24h default, max 30 days)           |
| Thread Storage     | Server-side (ML-KEM encrypted, permanent until deletion) |
| Data Persistence   | No permanent server-side storage for realtime messages |
| Local Storage      | IndexedDB (Argon2id-encrypted private keys, contacts) |
| Desktop App        | Microsoft Store, GitHub Releases                     |
| Browser Extension  | Google Chrome (Chrome Web Store)                     |

**Important:** Realtime messages are automatically deleted from Redis after expiration. Threads are stored server-side (ML-KEM encrypted) until collaborative deletion is approved. Majik Message servers cannot decrypt message content in either case—and neither can a quantum computer.

### Messaging Capabilities

| Feature                           | Status                         |
| --------------------------------- | ------------------------------ |
| Text Messages                     | ✓ Supported (post-quantum)     |
| Group Chats                       | ✓ Up to 25 participants (post-quantum) |
| Threads (Immutable Email)         | ✓ Supported (post-quantum)     |
| Thread Collaborative Deletion     | ✓ Supported                    |
| Thread Hash Chain Verification    | ✓ Supported                    |
| Emoji Support                     | ✓ Native emoji picker          |
| GIF Support                       | ✓ GIPHY integration            |
| Typing Indicators                 | ✓ Supported                    |
| Read Receipts                     | ✓ Supported                    |
| Message Expiration                | ✓ Custom timers available      |
| File/Image Sharing                | ✓ Supported                    |
| Voice Messages                    | ✓ Supported                    |
| P2P Audio Calling                 | ✓ Supported                    |

---

## Security

### What Majik Message Protects

- **Message content**: Post-quantum encrypted with ML-KEM-768 + AES-256-GCM—safe from quantum computers
- **Identity privacy**: No phone numbers or email addresses required
- **Private keys**: Never transmitted; encrypted at rest with Argon2id (64 MB memory-hard, GPU-resistant)
- **Future-proof security**: ML-KEM-768 (FIPS-203) ensures messages remain secure even when quantum computers become powerful
- **Forward secrecy**: Each message uses fresh ML-KEM encapsulation—past messages remain secure even if current keys are compromised
- **Message integrity**: Thread messages use SHA-256 hash chaining to detect tampering
- **Audit trails**: Downloadable, verifiable thread histories for compliance and records

### What Users Must Protect

- **Your 12-word seed phrase**: This is the ONLY way to recover your account. If lost, your account and messages are permanently inaccessible. Store it securely offline.
- **Your passphrase**: Protects your Argon2id-encrypted private keys in local storage. Choose a strong, unique passphrase.
- **Device security**: If your device is compromised while your account is unlocked, an attacker could access your private keys.

### What Majik Message Does Not Protect

- **Metadata**: Timing, message frequency, and participant relationships may be visible to servers or network observers
- **IP addresses**: Your IP address is visible to Majik Message servers when you connect for realtime messaging
- **Device compromise**: If malware or an attacker gains access to your unlocked device, they may access decrypted messages or private keys

### Post-Quantum Security Guarantees

- **NIST-standardized**: ML-KEM-768 (FIPS-203) is a U.S. government standard for post-quantum key encapsulation
- **Lattice-based cryptography**: Based on mathematical problems (Module Learning With Errors) that are believed to be hard for both classical and quantum computers
- **Conservative security level**: ML-KEM-768 provides security equivalent to AES-192—strong enough to resist even large-scale quantum computers
- **Future-proof**: Your messages encrypted today will remain secure even when quantum computers become mainstream

---

## Roadmap

Majik Message is under active development. Planned features include:

- **File and image sharing** (Coming soon): Send quantum-safe encrypted files and images directly through Majik Message
- **Voice messages** (Coming soon): Post-quantum encrypted audio recording and playback
- **Mobile apps** (Planned): Native iOS and Android applications with ML-KEM-768 support
- **Web app** (Coming soon): Full-featured browser-based application with post-quantum security
- **Paid tiers** (Coming soon): Subscription and pay-as-you-go options with increased account limits and extended message retention

---

## Use Cases

### Privacy-Conscious Individuals
If you want quantum-safe secure messaging without linking your phone number or email address, Majik Message provides true anonymity. Your messages will remain private even in a post-quantum world.

### Future-Proof Security for High-Value Communications
Governments, militaries, and intelligence agencies are already preparing for quantum computers. If your communications need to remain secure for decades (state secrets, long-term business strategies, sensitive research), Majik Message's ML-KEM-768 encryption protects against 'harvest now, decrypt later' attacks.

### Journalists
Communicate with sources securely with quantum-resistant encryption. The offline encryption capability allows you to exchange encrypted messages through air-gapped systems or untrusted networks without exposing sensitive information—and the encryption will remain strong even when quantum computers arrive.

### Professionals Handling Sensitive Data
Lawyers, healthcare providers, researchers, and other professionals can use Majik Message to communicate confidentially with quantum-safe encryption without relying on third-party platforms. Your encrypted communications today will remain private even in 2040.

### Security Researchers and Cryptography Professionals
Majik Message's cryptographic implementation is transparent and uses well-audited libraries (@stablelib, @noble/post-quantum). It's suitable for technical users who want verifiable, inspectable post-quantum encryption based on NIST standards.

### Anyone Seeking Digital Autonomy
If you believe your communications should be private by default—now and in the future—and you want full control over your identity and data, Majik Message is designed for you. Your messages are quantum-safe: even a powerful quantum computer cannot break the encryption.

---

## Pricing

Majik Message is currently **free for all users**. Realtime messaging, post-quantum encryption, and all core features are available at no cost.

**Coming soon:** Paid subscription and pay-as-you-go models with expanded account limits and additional features will be available in the future.

---

## Part of the Majikah Ecosystem

Majik Message is a flagship product within the Majikah system—a suite of privacy-focused, user-controlled tools designed to give individuals full ownership of their digital communications and data.

All Majikah products share the same core principles: cryptographic identity, zero-knowledge architecture, post-quantum security, and user sovereignty over personal information.

---

## Related Projects

### [Majik Key](https://majikah.solutions/sdk/majik-key)
**Majik Key** is a seed phrase account library for creating, managing, and parsing mnemonic-based cryptographic accounts (Majik Keys). Generate deterministic key pairs from BIP39 seed phrases with simple, developer-friendly APIs. Now supports ML-KEM-768 post-quantum key derivation alongside X25519.

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
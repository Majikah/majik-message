# Security Policy — Majik Message
[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)


## Overview

**Majik Message** is a post-quantum secure, end-to-end encrypted messaging platform. Security, privacy, and user sovereignty are our core principles. 

This policy outlines our security model, cryptographic standards, and vulnerability disclosure process.

---

## Project Information

- **Repository:** https://github.com/Majikah/majik-message  
- **NPM Package:** https://www.npmjs.com/package/@majikah/majik-message  
- **Website:** https://majikah.solutions  
- **Web App:** https://message.majikah.solutions  
- **Security Contact:** **business@majikah.solutions**

---

## Security Model
Majik Message is built on a Zero-Trust, Local-First architecture:

- **Post-Quantum End-to-End Encryption (PQ-E2EE)**: Messages are protected by a hybrid cryptographic scheme designed to remain secure against future quantum computer attacks.

- **Cryptographic Identity**: Accounts are derived entirely from 12-word seed phrases (BIP-39). We do not use phone numbers, emails, or central registries for identity.

- **Immutable Hash-Chain Integrity**: "Threads" utilize SHA-256 hash-chaining to create a tamper-evident record where messages cannot be silently altered or deleted.

- **Collaborative Deletion**: Permanent records (Threads) require the cryptographic consent of all participants before they can be purged from the relay network.

- **Local Secret Management**: Private keys are encrypted at rest using Argon2id and never leave the user's device.

---

## Cryptography

We utilize NIST-standardized and industry-vetted primitives in a hybrid construction:

- **Key Encapsulation**: ML-KEM-768 (FIPS-203) for post-quantum security, layered with X25519 for classical identity verification.

- **Authenticated Encryption**: AES-256-GCM for message confidentiality and tamper detection.

- **Key Derivation (KDF)**: Argon2id (64MB memory, 3 iterations) for securing local keys against brute-force and GPU-based attacks.

- **Identity Fingerprinting**: SHA-256 hashes of public keys are used for verifiable contact identification.

- **Integrity**: SHA-256 for linking messages in Thread chains to prevent history manipulation.

⚠️ **Important:**  
Majik Message does **not** claim to be formally audited or mathematically proven secure unless explicitly stated. Use in high-risk environments should be evaluated accordingly.

---

## Supported Versions
We actively support and provide security patches for:

- Version 1.1.0 and higher: Our current stable, post-quantum era release.

- NPM Package: [@majikah/majik-message](https://www.npmjs.com/package/@majikah/majik-message) (latest).

- Main Branch: The main branch of this repository.

⚠️ **Note**:
Versions prior to 1.1.0 use legacy PBKDF2 and do not support post-quantum encryption. Users are encouraged to upgrade immediately.

---

## Reporting a Vulnerability

We take security reports seriously and appreciate responsible disclosure.

### How to Report

If you discover a vulnerability, please **do not open a public GitHub issue**.

Instead, email us directly at:

**[business@majikah.solutions](mailto:business@majikah.solutions)**

Include as much detail as possible:

- Description of the vulnerability
- Steps to reproduce (if applicable)
- Affected versions or commits
- Potential impact
- Any proof-of-concept code (if safe to share)

---

### Response Expectations

- **Acknowledgement:** within **72 hours**
- **Initial assessment:** within **5 business days**
- **Fix or mitigation:** as soon as reasonably possible, depending on severity

We may request additional details or clarification during investigation.

---

## Coordinated Disclosure

We kindly ask reporters to:

- Allow us reasonable time to investigate and patch the issue
- Avoid public disclosure until a fix or mitigation is available
- Act in good faith and avoid data exfiltration or abuse

We are open to crediting security researchers when appropriate.

---

## Out of Scope

The following are generally considered **out of scope** unless they demonstrate real-world impact:

- Denial-of-service via excessive resource usage
- Social engineering attacks
- Vulnerabilities in third-party dependencies (unless exploited through Majik Message)
- Misconfiguration or insecure usage by application developers

---

## Security Best Practices for Users

- **Seed Phrase Safety**: Your 12-word seed phrase is your only recovery method. If lost, your account and all encrypted archives are unrecoverable.
- **Verify Fingerprints**: Always verify a contact’s public key fingerprint (available in the Contact Card) through an out-of-band channel.
- **Session Security**: When using the Chrome Extension, ensure your host machine is secure, as keys are held in memory during your active session.
  
---

## Disclaimer

Majik Message is provided **“as is.”** While we use state-of-the-art post-quantum primitives (ML-KEM-768), this software has not undergone a formal third-party mathematical audit. 
Use in high-stakes or life-critical environments should be preceded by an independent security review.

Use at your own risk.

---

## Final Note

Security is an ongoing process, not a one-time feature.  
If you care about privacy, encryption, and user sovereignty — you’re already aligned with our mission.

Thank you for helping keep **Majik Message** secure.

— **Majikah**


---
# [Majik Message](https://message.majikah.solutions)

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)


**Majik Message** is a post-quantum secure messaging platform built on cryptographic identity. Your account is your encryption keys—no phone numbers, no passwords, just your 12-word seed phrase and complete privacy. Safe from quantum computers.

![npm](https://img.shields.io/npm/v/@majikah/majik-message) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-message) ![npm bundle size](https://img.shields.io/bundlephobia/min/%40majikah%2Fmajik-message) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)



[Read more about Majik Message here](https://majikah.solutions/products/majik-message)

[![Majik Message Thumbnail](https://github.com/user-attachments/assets/d433c6b8-1841-4fa1-a6da-b348029d1dbe)](https://message.majikah.solutions)

> Click the image to try Majik Message live.

[Read Docs](https://majikah.solutions/products/majik-message/docs)


[![Majik Message Microsoft App Store](https://get.microsoft.com/images/en-us%20light.svg)](https://apps.microsoft.com/detail/9pmjgvzzjspn)


Also available on [Microsoft Store](https://apps.microsoft.com/detail/9pmjgvzzjspn) for free.


[![Majik Message Google Chrome Web Store](https://developer.chrome.com/static/docs/webstore/branding/image/UV4C4ybeBTsZt43U4xis.png)](https://chromewebstore.google.com/detail/dhlafmkpgjagkhiokoighjaakajbckck)


Also available on [Google Chrome Web Store](https://chromewebstore.google.com/detail/dhlafmkpgjagkhiokoighjaakajbckck) for free.




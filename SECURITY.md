# Security Policy — Majik Message
[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)


## Overview

**Majik Message** is an end-to-end encrypted messaging library and platform developed by **Majikah**.  
Security, privacy, and user trust are core principles of this project.

This document explains how we approach security, how to responsibly disclose vulnerabilities, and what users and contributors can expect from us.

---

## Project Information

- **Repository:** https://github.com/Majikah/majik-message  
- **NPM Package:** https://www.npmjs.com/package/@majikah/majik-message  
- **Website:** https://majikah.solutions  
- **Web App:** https://message.majikah.solutions  
- **Security Contact:** **business@majikah.solutions**

---

## Security Model

Majik Message is designed with the following security goals:

- **End-to-End Encryption (E2EE)**  
  Message content is encrypted client-side and is not readable by servers or intermediaries.

- **Zero-Knowledge Principles**  
  Servers do not have access to plaintext messages, private keys, or decrypted content.

- **Key Ownership**  
  Users retain control of their cryptographic keys. Private keys are never transmitted or stored in plaintext.

- **Minimal Trust Surface**  
  Backend services are treated as untrusted transport and storage layers only.

---

## Cryptography

Majik Message uses modern, industry-standard cryptographic primitives where applicable, including but not limited to:

- Public-key cryptography for identity and message exchange
- Authenticated encryption for message confidentiality and integrity
- Secure random number generation
- Forward-secrecy–friendly patterns where supported

⚠️ **Important:**  
Majik Message does **not** claim to be formally audited or mathematically proven secure unless explicitly stated. Use in high-risk environments should be evaluated accordingly.

---

## Supported Versions

We actively support the **latest published version** of:

- The NPM package `@majikah/majik-message`
- The `main` branch of the GitHub repository

Older versions may contain unpatched vulnerabilities and are **not guaranteed** to receive security fixes.

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

We strongly recommend that developers using Majik Message:

- Protect private keys and secrets at rest
- Use secure storage mechanisms (OS keychain, secure enclaves, etc.)
- Validate and sanitize all untrusted input
- Keep dependencies and runtime environments up to date
- Avoid logging sensitive cryptographic material

---

## Disclaimer

Majik Message is provided **“as is”**, without warranty of any kind.  
While we strive to maintain high security standards, no system is completely immune to vulnerabilities.

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




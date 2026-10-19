# Security Policy

The Optical Diagram Recognition (ODR) project takes the security and privacy of its users seriously. As a local-first software product handling potentially sensitive documents, technical architectures, and proprietary diagrams, security is central to our design.

## Supported Versions

Security updates and patches are provided for the following versions:

| Version | Supported | Notes |
|---|---|---|
| `2.0.x` | Yes | Current stable release line. |
| `< 2.0.0` | No | Legacy prototype releases; please upgrade to 2.0.0. |

---

## Scope of Security Considerations

ODR is designed as a local-first desktop/workstation application. Key security surfaces include:

1. **Local File Ingestion & Parsing**: Handling untrusted image files (`.png`, `.jpg`, `.webp`) and multi-page documents (`.pdf`). Safeguards are implemented to prevent memory exhaustion, image decompression bombs, and buffer overflows.
2. **Project Persistence & Path Traversal**: Storage operations in `data/projects/{project_id}` use sanitized identifiers and atomic file operations to prevent arbitrary file writes or directory traversal.
3. **Export Generation**: Sanitization of diagram labels in generated Mermaid and PlantUML files to prevent code injection or parser exploitation.
4. **Offline Privacy**: ODR performs zero outbound network calls during image preprocessing, OCR inference, shape detection, or export rendering.

---

## Reporting a Vulnerability

If you discover a security vulnerability in ODR, please report it privately. **Do not disclose the vulnerability in public GitHub issues, pull requests, or discussions.**

### Preferred Reporting Method

1. **GitHub Private Vulnerability Reporting**: If enabled on the repository, submit a report via [GitHub Security Advisories](https://github.com/v3ravani/Optical-Diagram-Recognition-ODR-/security/advisories/new).
2. **Direct Maintainer Contact**: Alternatively, contact the maintainer directly via email:
   - **Email**: `ravaniviraj@gmail.com`
   - **Subject Line**: `[SECURITY] ODR Vulnerability Report - <Brief Description>`

### Information to Include in Your Report

To help us triage and resolve the issue quickly, please provide:

- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions to reproduce the issue.
- A proof-of-concept image or script (redacting any proprietary or personal information).
- The operating system, Python version, Node.js version, and ODR version tested.
- Any suggested fixes or remediation steps.

**Important Note on Test Data**: Do not include proprietary technical diagrams, credentials, or personal identifying information in vulnerability reports. Use synthetic or anonymized test images.

---

## Response Process and Remediation

When a vulnerability report is received:

1. **Acknowledgment**: The maintainer will acknowledge receipt of the report.
2. **Assessment**: The maintainer will investigate the issue, reproduce the vulnerability, and assess severity.
3. **Patch Development**: A fix will be developed and validated against existing regression test suites.
4. **Disclosure**: A patched release will be published. Once the patch is released, a public security advisory will be published crediting the reporter (unless anonymity is requested).

We appreciate the responsible disclosure of security issues and thank the community for helping keep ODR secure.

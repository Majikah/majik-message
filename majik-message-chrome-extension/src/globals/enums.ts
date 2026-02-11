

export enum GlobalSheetView {
    VIEW = "View",
    EDIT = "Edit",
    CREATE = "Create",
    DELETE = "Delete",
    ARCHIVE = "Archive",
    CUSTOM_A = "Custom-A",
    CUSTOM_B = "Custom-B",
    CUSTOM_C = "Custom-C",
    CLOSED = "Closed"
}

export enum GlobalViewType {
    LIST = "List",
    GRID = "Grid",
    TABLE = "Table"
}


/*
ENUM FOR DATA PRIVACY TERMS

*/

export const ENUM_DataPrivacyTerms = Object.freeze({
    SCOPE: {
        index: 1,
        title: 'Scope',
        subitems: [
            {
                subtitle: 'This Agreement governs the collection, use, storage, and protection of personal information by The Zelijah World in accordance with the Data Privacy Act of 2012 and other applicable global data protection regulations.',
                subitems: []
            }
        ]
    },
    COLLECTION_PROCESSING: {
        index: 2,
        title: 'Collection and Processing of Personal Information',
        subitems: [
            {
                subtitle: 'The Zelijah World may collect personal information from users for legitimate creative, analytical, or service-related purposes.',
                subitems: [
                    'Full name',
                    'Email address',
                    'Social media handles (e.g. Instagram, Pinterest)',
                    'IP address and device metadata',
                    'Creative preferences and feedback',
                    'Newsletter subscriptions',
                    'Usage behavior and interaction logs'
                ]
            },
            {
                subtitle: 'Users will be informed of the purpose behind each data collection point and may choose to opt in or out at any time.',
                subitems: []
            }
        ]
    },
    USE_OF_INFORMATION: {
        index: 3,
        title: 'Use of Personal Information',
        subitems: [
            {
                subtitle: 'Personal information will be used solely to improve creative content, digital experiences, communication, and engagement across The Zelijah World platforms.',
                subitems: []
            },
            {
                subtitle: 'The Zelijah World does not engage in data resale and will never use personal data for purposes not disclosed at the time of collection.',
                subitems: []
            }
        ]
    },
    PINTEREST_PERMISSIONS: {
        index: 4,
        title: 'Pinterest Data Permissions',
        subitems: [
            {
                subtitle: 'If users engage with The Zelijah World via Pinterest, they may grant permission to access publicly available data for curated visual experiences and style personalization.',
                subitems: [
                    'Board and pin interactions',
                    'Follower/following metadata',
                    'User-submitted pins for collaborative projects'
                ]
            },
            {
                subtitle: 'Pinterest data will be used strictly for enhancing user experience and will never be stored permanently without explicit consent.',
                subitems: []
            }
        ]
    },
    SECURITY_MEASURES: {
        index: 5,
        title: 'Security Measures',
        subitems: [
            {
                subtitle: 'The Zelijah World uses industry-standard security protocols to ensure the protection of user data across all touchpoints.',
                subitems: [
                    'End-to-end encryption for communications',
                    'Secure cloud storage with access control',
                    'Regular penetration testing and audits',
                    'Anonymization for behavioral analytics',
                    'Automated data cleanup based on retention policies'
                ]
            }
        ]
    },
    DATA_SUBJECT_RIGHTS: {
        index: 6,
        title: 'Data Subject Rights',
        subitems: [
            {
                subtitle: 'Users may access, modify, export, or delete their data upon request at any time.',
                subitems: []
            },
            {
                subtitle: 'Contact the team at business@thezelijah.world for data-related inquiries.',
                subitems: []
            }
        ]
    },
    DISCLOSURE_INFORMATION: {
        index: 7,
        title: 'Disclosure of Personal Information',
        subitems: [
            {
                subtitle: 'User data may be shared with third-party platforms only to support integrated experiences (e.g. video streaming, analytics) and only with user consent.',
                subitems: []
            },
            {
                subtitle: 'All partners are required to uphold equivalent or higher privacy standards.',
                subitems: []
            }
        ]
    },
    DATA_BREACH_NOTIFICATION: {
        index: 8,
        title: 'Data Breach Notification',
        subitems: [
            {
                subtitle: 'Users will be notified of any confirmed data breaches within 72 hours, with remediation details provided.',
                subitems: []
            }
        ]
    },
    DATA_RETENTION: {
        index: 9,
        title: 'Data Retention',
        subitems: [
            {
                subtitle: 'Data will be retained only as long as needed for user experience or legal compliance—typically no longer than 2 years after last user interaction.',
                subitems: []
            }
        ]
    },
    INTERNATIONAL_DATA_TRANSFERS: {
        index: 10,
        title: 'International Data Transfers',
        subitems: [
            {
                subtitle: 'The Zelijah World may transfer data internationally through secure, GDPR-compliant infrastructure as part of cloud hosting or content delivery networks.',
                subitems: []
            }
        ]
    },
    LEGAL_BASIS_PROCESSING: {
        index: 11,
        title: 'Legal Basis for Processing',
        subitems: [
            {
                subtitle: 'Data is processed based on user consent, contractual necessity, and compliance with legal obligations.',
                subitems: []
            }
        ]
    },
    COMPLIANCE: {
        index: 12,
        title: 'Compliance',
        subitems: [
            {
                subtitle: 'The Zelijah World complies with the Data Privacy Act of 2012, GDPR, CCPA, and other applicable global privacy frameworks.',
                subitems: []
            }
        ]
    },
    CONTACT_INFORMATION: {
        index: 13,
        title: 'Contact Information',
        subitems: [
            {
                subtitle: 'For privacy-related concerns or questions, email us at business@thezelijah.world',
                subitems: []
            }
        ]
    }
});





/*
ENUM FOR TERMS OF AGREEMENT
*/

export const ENUM_TermsOfAgreement = Object.freeze({
    INTRODUCTION: {
        index: 1,
        title: 'Introduction',
        subitems: [
            {
                subtitle: 'Welcome to The Zelijah World. These Terms of Agreement ("Terms") govern your access and use of our software platform ("Platform"), including tools such as Price Genie, Buwis Friend, and any other services we provide. By using our Platform, you agree to be bound by these Terms. If you do not agree, please discontinue use of the Platform immediately.',
                subitems: []
            }
        ]
    },
    ACCEPTANCE_OF_TERMS: {
        index: 2,
        title: 'Acceptance of Terms',
        subitems: [
            {
                subtitle: 'By using any services or tools offered by The Zelijah World, you acknowledge that you have read, understood, and agreed to be bound by these Terms, as well as any future modifications which we may post from time to time.',
                subitems: []
            }
        ]
    },
    ELIGIBILITY: {
        index: 3,
        title: 'Eligibility',
        subitems: [
            {
                subtitle: 'You must be at least 18 years of age or the age of legal majority in your jurisdiction to access or use the Platform. By using the Platform, you confirm that you meet these requirements.',
                subitems: []
            }
        ]
    },
    SERVICES_PROVIDED: {
        index: 4,
        title: 'Services Provided',
        subitems: [
            {
                subtitle: 'The Zelijah World offers digital tools and resources for creatives, freelancers, and businesses, including pricing simulation tools (Price Genie), tax helpers (Buwis Friend), contract generators, and other support utilities. These are designed to assist in project management, financial planning, and legal documentation.',
                subitems: []
            }
        ]
    },
    USAGE_AND_ACCESS: {
        index: 5,
        title: 'Usage and Access',
        subitems: [
            {
                subtitle: 'You are granted a limited, non-exclusive, non-transferable license to use the Platform for personal or business purposes. Unauthorized use, resale, or modification of any feature or data is strictly prohibited.',
                subitems: []
            }
        ]
    },
    ACCOUNTS_AND_SECURITY: {
        index: 6,
        title: 'Accounts and Security',
        subitems: [
            {
                subtitle: 'You may be required to create an account to use certain features. You are responsible for safeguarding your login credentials and all activity under your account.',
                subitems: []
            }
        ]
    },
    PAYMENTS_AND_SUBSCRIPTIONS: {
        index: 7,
        title: 'Payments and Subscriptions',
        subitems: [
            {
                subtitle: 'Certain tools may require payment or subscription. Fees are clearly stated and must be paid in advance. Refunds will only be granted in accordance with our refund policy.',
                subitems: []
            },
            {
                subtitle: 'We reserve the right to modify pricing or subscription terms with prior notice to users.',
                subitems: []
            }
        ]
    },
    USER_CONDUCT: {
        index: 8,
        title: 'User Conduct',
        subitems: [
            {
                subtitle: 'You agree not to misuse the Platform, attempt unauthorized access, or engage in any activity that could harm our systems, other users, or violate applicable laws.',
                subitems: []
            }
        ]
    },
    DATA_PRIVACY: {
        index: 9,
        title: 'Data Privacy',
        subitems: [
            {
                subtitle: 'We collect and process personal information in accordance with our Privacy Policy and the Data Privacy Act of 2012. By using the Platform, you consent to the collection and use of your data as described.',
                subitems: []
            }
        ]
    },
    DISCLAIMERS_LIMITATION_LIABILITY: {
        index: 10,
        title: 'Disclaimers and Limitation of Liability',
        subitems: [
            {
                subtitle: 'All services and tools are provided "as is" without warranties of any kind. We do not guarantee the accuracy, reliability, or completeness of results generated by our tools.',
                subitems: []
            },
            {
                subtitle: 'To the fullest extent allowed by law, we disclaim liability for damages or losses resulting from use of the Platform.',
                subitems: []
            }
        ]
    },
    INTELLECTUAL_PROPERTY: {
        index: 11,
        title: 'Intellectual Property',
        subitems: [
            {
                subtitle: 'All trademarks, logos, code, and content within The Zelijah World, including but not limited to Price Genie and Buwis Friend, are the intellectual property of The Zelijah World or its licensors. You may not copy, reuse, or distribute any content without explicit permission.',
                subitems: []
            }
        ]
    },
    INDEMNIFICATION: {
        index: 12,
        title: 'Indemnification',
        subitems: [
            {
                subtitle: 'You agree to indemnify, defend, and hold harmless The Zelijah World and its team from any claims, damages, or losses arising from your use of the Platform or violation of these Terms.',
                subitems: []
            }
        ]
    },
    TERMINATION: {
        index: 13,
        title: 'Termination',
        subitems: [
            {
                subtitle: 'We reserve the right to suspend or terminate access to your account at any time, without notice, if you breach these Terms or engage in harmful conduct.',
                subitems: []
            }
        ]
    },
    GOVERNING_LAW_DISPUTE_RESOLUTION: {
        index: 14,
        title: 'Governing Law and Dispute Resolution',
        subitems: [
            {
                subtitle: 'These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any disputes arising from these Terms shall be resolved through arbitration in accordance with the rules of the Philippine Dispute Resolution Center, Inc. (PDRCI).',
                subitems: []
            }
        ]
    },
    MODIFICATION_OF_TERMS: {
        index: 15,
        title: 'Modification of Terms',
        subitems: [
            {
                subtitle: 'We may update these Terms from time to time. Continued use of the Platform after such updates constitutes acceptance of the revised Terms.',
                subitems: []
            }
        ]
    },
    CONTACT_INFORMATION: {
        index: 16,
        title: 'Contact Information',
        subitems: [
            {
                subtitle: 'For inquiries or support related to these Terms or the Platform, please contact us at business@zelijah.world',
                subitems: []
            }
        ]
    }
});

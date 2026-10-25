export const REPORT_REASONS = [
  { value: 'low-quality', label: 'Low quality' },
  { value: 'broken', label: 'Broken or doesn\u2019t install' },
  { value: 'security', label: 'Malicious or security problem' },
  { value: 'spam', label: 'Spam' },
  { value: 'license', label: 'License problem' },
  { value: 'other', label: 'Other' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];
export const REPORT_MESSAGE_MAX = 2000;

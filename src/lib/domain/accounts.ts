export type PublicUser = { id: string; email: string; name: string; emailVerified: boolean };
export type AlertPrefs = {
  enabled: boolean;
  minRisk: number;
  supplyChainOnly: boolean;
  latamOnly: boolean;
};
export const defaultAlertPrefs: AlertPrefs = {
  enabled: false,
  minRisk: 60,
  supplyChainOnly: true,
  latamOnly: true,
};

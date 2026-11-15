export interface DesignTokenColors {
  [key: string]: string | DesignTokenColors;
}

export const palette: DesignTokenColors;
export const radius: Record<string, string>;
export const designTokens: {
  colors: DesignTokenColors;
  borderRadius: Record<string, string>;
};

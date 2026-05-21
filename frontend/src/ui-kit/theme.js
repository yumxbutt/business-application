// Design System: Color Palette, Spacing, Typography
export const theme = {
  colors: {
    primary: '#1A2238', // Deep Navy
    accent: '#21E6C1',  // Emerald Green
    warning: '#FFB800', // Amber
    danger: '#FF5E5B',  // Coral Red
    background: '#F6F8FB', // Soft Gray
    surface: '#FFFFFF',
    text: '#22223B',
    textSecondary: '#6B7280',
  },
  borderRadius: {
    card: '16px',
    button: '8px',
    table: '12px',
  },
  spacing: (factor) => `${factor * 8}px`, // 8px grid
  font: {
    family: 'Inter, sans-serif',
    size: '16px',
    lineHeight: 1.5,
    weight: {
      regular: 400,
      semibold: 600,
      bold: 700,
    },
  },
  shadow: '0 4px 24px rgba(26,34,56,0.08)',
};

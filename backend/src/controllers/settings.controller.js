const { CompanySettings } = require('../models');

const normalizeBusinessMode = (value) => {
  if (value === 'wholesale') return 'wholesale';
  if (value === 'restaurant') return 'restaurant';
  return 'retail';
};
const toRate = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
};

const getSettings = async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({ order: [['id', 'ASC']] });
    if (!settings) {
      return res.json({
        businessMode: 'retail',
        cashTaxRate: 0,
        cardTaxRate: 0,
      });
    }
    const json = settings.toJSON();
    json.businessMode = normalizeBusinessMode(json.businessMode);
    json.cashTaxRate = toRate(json.cashTaxRate);
    json.cardTaxRate = toRate(json.cardTaxRate);
    return res.json(json);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const saveSettings = async (req, res) => {
  try {
    const {
      companyName,
      tagline,
      address,
      phone,
      email,
      logoUrl,
      footerNote,
      businessMode,
      cashTaxRate,
      cardTaxRate,
    } = req.body;
    const mode = normalizeBusinessMode(businessMode);
    const cashRate = toRate(cashTaxRate);
    const cardRate = toRate(cardTaxRate);
    const payload = {
      companyName,
      tagline,
      address,
      phone,
      email,
      logoUrl,
      footerNote,
      businessMode: mode,
      cashTaxRate: cashRate,
      cardTaxRate: cardRate,
      updatedById: req.user ? req.user.id : null,
    };
    const existing = await CompanySettings.findOne({ order: [['id', 'ASC']] });
    if (existing) {
      await existing.update(payload);
      const json = existing.toJSON();
      json.businessMode = mode;
      json.cashTaxRate = cashRate;
      json.cardTaxRate = cardRate;
      return res.json(json);
    }
    const created = await CompanySettings.create(payload);
    const json = created.toJSON();
    json.businessMode = mode;
    json.cashTaxRate = cashRate;
    json.cardTaxRate = cardRate;
    return res.json(json);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

module.exports = { getSettings, saveSettings };

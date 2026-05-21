const { CompanySettings } = require('../models');

const getSettings = async (req, res) => {
  try {
    const settings = await CompanySettings.findOne({ order: [['id', 'ASC']] });
    return res.json(settings || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const saveSettings = async (req, res) => {
  try {
    const { companyName, tagline, address, phone, email, logoUrl, footerNote } = req.body;
    const existing = await CompanySettings.findOne({ order: [['id', 'ASC']] });
    if (existing) {
      await existing.update({
        companyName, tagline, address, phone, email, logoUrl, footerNote,
        updatedById: req.user ? req.user.id : null,
      });
      return res.json(existing);
    }
    const created = await CompanySettings.create({
      companyName, tagline, address, phone, email, logoUrl, footerNote,
      updatedById: req.user ? req.user.id : null,
    });
    return res.json(created);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

module.exports = { getSettings, saveSettings };

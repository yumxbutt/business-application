import { useEffect, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { productService } from '../services/productService';

const defaultAttributeForm = { name: '', code: '' };
const defaultValueForm = { value: '', code: '' };

export default function ProductAttributesPage() {
  const [attributes, setAttributes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [attributeModalOpen, setAttributeModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [attributeForm, setAttributeForm] = useState(defaultAttributeForm);

  const [valueModalOpen, setValueModalOpen] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [valueForm, setValueForm] = useState(defaultValueForm);

  const loadAttributes = async () => {
    setLoading(true);
    setError('');
    try {
      setAttributes(await productService.getAttributes());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttributes();
  }, []);

  const closeAttributeModal = () => {
    setAttributeModalOpen(false);
    setEditingId(null);
    setAttributeForm(defaultAttributeForm);
  };

  const closeValueModal = () => {
    setValueModalOpen(false);
    setSelectedAttribute(null);
    setValueForm(defaultValueForm);
  };

  const openCreateAttribute = () => {
    setEditingId(null);
    setAttributeForm(defaultAttributeForm);
    setError('');
    setAttributeModalOpen(true);
  };

  const openEditAttribute = (record) => {
    setEditingId(record.id);
    setAttributeForm({ name: record.name || '', code: record.code || '' });
    setError('');
    setAttributeModalOpen(true);
  };

  const openAddValue = (record) => {
    setSelectedAttribute(record);
    setValueForm(defaultValueForm);
    setError('');
    setValueModalOpen(true);
  };

  const onAttributeChange = (event) => {
    const { name, value } = event.target;
    setAttributeForm((prev) => ({ ...prev, [name]: value }));
  };

  const onValueChange = (event) => {
    const { name, value } = event.target;
    setValueForm((prev) => ({ ...prev, [name]: value }));
  };

  const onAttributeSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const payload = {
      name: attributeForm.name,
      code: attributeForm.code || null,
    };

    try {
      if (editingId) {
        await productService.updateAttribute(editingId, payload);
      } else {
        await productService.createAttribute(payload);
      }
      closeAttributeModal();
      await loadAttributes();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onAttributeStatusToggle = async (record) => {
    try {
      await productService.updateAttribute(record.id, { isActive: !record.isActive });
      await loadAttributes();
    } catch (statusError) {
      setError(statusError.message);
    }
  };

  const onValueSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAttribute) return;

    setError('');
    try {
      await productService.addAttributeValue(selectedAttribute.id, {
        value: valueForm.value,
        code: valueForm.code || null,
      });
      closeValueModal();
      await loadAttributes();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Product Attributes"
        actions={
          <button type="button" className="primary-action-button" onClick={openCreateAttribute}>
            Add Attribute
          </button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <p>Loading attributes...</p> : null}

        <div className="table-wrap table-wrap--full">
          <table className="data-table data-table--users">
            <thead>
              <tr>
                <th>Attribute</th>
                <th>Code</th>
                <th>Values</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((record) => (
                <tr key={record.id}>
                  <td>{record.name}</td>
                  <td>{record.code}</td>
                  <td>{(record.values || []).map((item) => item.value).join(', ') || '-'}</td>
                  <td>
                    <ToggleSwitch
                      checked={record.isActive}
                      onChange={() => onAttributeStatusToggle(record)}
                      label={`Toggle status for ${record.name}`}
                    />
                  </td>
                  <td className="text-right">
                    <div className="inline-actions inline-actions--end">
                      <button type="button" className="table-action-button" onClick={() => openAddValue(record)}>
                        Add Value
                      </button>
                      <button type="button" className="table-action-button" onClick={() => openEditAttribute(record)}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && attributes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state-cell">No attributes found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {attributeModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Attribute' : 'Add Attribute'}
          subtitle="Create or update an attribute"
          onClose={closeAttributeModal}
        >
          <form className="auth-form modal-form" onSubmit={onAttributeSubmit}>
            <div className="modal-form-grid">
              <FormField
                label="Attribute Name"
                name="name"
                value={attributeForm.name}
                onChange={onAttributeChange}
                required
              />
              <FormField
                label="Code"
                name="code"
                value={attributeForm.code}
                onChange={onAttributeChange}
              />
            </div>

            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={closeAttributeModal}>
                Cancel
              </button>
              <button type="submit">{editingId ? 'Update Attribute' : 'Create Attribute'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {valueModalOpen ? (
        <ModalDialog
          title={`Add Value: ${selectedAttribute?.name || ''}`}
          subtitle="Add selectable value for this attribute"
          onClose={closeValueModal}
        >
          <form className="auth-form modal-form" onSubmit={onValueSubmit}>
            <div className="modal-form-grid">
              <FormField
                label="Value"
                name="value"
                value={valueForm.value}
                onChange={onValueChange}
                required
              />
              <FormField label="Code" name="code" value={valueForm.code} onChange={onValueChange} />
            </div>

            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={closeValueModal}>
                Cancel
              </button>
              <button type="submit">Add Value</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
import React from 'react';
import { Textfield, Form, Label, RequiredAsterisk } from '@forge/react';
import ForgeReconciler from '@forge/react';
import { useWidgetConfig } from '@forge/hooks/dashboards';
import { widgetEdit } from '@forge/dashboards-bridge';

const TITLE_FIELD = 'widgetTitle';

widgetEdit.onSave(async (config, { widgetId }) => {
  console.log('Widget saved!', config, widgetId);
});

// Optional: If you want to save the widget in-product, or update the config before saving
widgetEdit.onProductSave(async (config) => {
  console.log('Widget config before saving in-product!', config);
  return null; // return config to opt-in to in-product save
});

export const Edit = () => {
  const { config, updateConfig } = useWidgetConfig();

  return (
    <Form>
      <Label labelFor="widget-title">
        Widget Title
        <RequiredAsterisk />
      </Label>
      <Textfield
        id="widget-title"
        value={config?.[TITLE_FIELD]}
        placeholder="Enter widget title"
        onChange={(e) => {
          updateConfig({
            [TITLE_FIELD]: e.target.value
          });
        }}
      />
    </Form>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <Edit />
  </React.StrictMode>
);

import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, PieChart } from '@forge/react';
import { invoke } from '@forge/bridge';
import { useWidgetConfig, useWidgetContext } from '@forge/hooks/dashboards';
import { widget } from '@forge/dashboards-bridge';

const TITLE_FIELD = 'widgetTitle';

widget.setPreviewConfig({
  [TITLE_FIELD]: 'Sample Title'
});

export const View = () => {
  const [pieChartData, setPieChartData] = useState(null);
  const { config } = useWidgetConfig();
  const { layout } = useWidgetContext() || {};

  useEffect(() => {
    (async () => {
      const data = await invoke('getPieChartData', {
        example: 'my-invoke-variable'
      });
      setPieChartData(data);
    })();
  }, []);

  if (!pieChartData) {
    return <Text>Loading...</Text>;
  }

  return (
    <PieChart
      title={config?.[TITLE_FIELD]}
      data={pieChartData}
      colorAccessor="type"
      labelAccessor="label"
      valueAccessor="value"
      height={layout?.height}
      width={layout?.width}
    />
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <View />
  </React.StrictMode>
);

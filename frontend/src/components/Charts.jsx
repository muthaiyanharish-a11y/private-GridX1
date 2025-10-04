import React from 'react';
import { Pie, Line } from 'react-chartjs-2';
import { pieChartOptions, lineChartOptions, chartColors } from './ChartConfig';

export function StatusPieChart({ data }) {
  return (
    <Pie
      data={{
        labels: ['OK', 'Warnings', 'Faults'],
        datasets: [{
          data: [data.ok, data.warnings, data.faults],
          backgroundColor: [chartColors.ok, chartColors.warning, chartColors.fault]
        }]
      }}
      options={pieChartOptions}
    />
  );
}

export function TrendLineChart({ data }) {
  return (
    <Line
      data={{
        labels: data.labels,
        datasets: [
          {
            label: 'Faults',
            data: data.faults,
            borderColor: chartColors.fault,
            backgroundColor: `${chartColors.fault}20`,
            fill: true,
            tension: 0.2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: chartColors.fault
          },
          {
            label: 'Warnings',
            data: data.warnings,
            borderColor: chartColors.warning,
            backgroundColor: `${chartColors.warning}20`,
            fill: true,
            tension: 0.2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: chartColors.warning
          }
        ]
      }}
      options={lineChartOptions}
    />
  );
}
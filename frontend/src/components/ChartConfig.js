import { Chart as ChartJS } from 'chart.js';
import {
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Common chart styles
export const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 20,
        usePointStyle: true,
        font: {
          size: 12
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(255,255,255,0.98)',
      titleColor: '#1f2937',
      bodyColor: '#4b5563',
      borderColor: 'rgba(0,0,0,0.1)',
      borderWidth: 1,
      padding: 12,
      bodySpacing: 8,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || '';
          const value = context.raw || 0;
          if (context.chart.config.type === 'pie') {
            const total = context.dataset.data.reduce((a,b) => a+b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
          return `${label}: ${value}`;
        }
      }
    }
  },
  animation: {
    duration: 800,
    easing: 'easeOutQuart'
  }
};

// Line chart specific options
export const lineChartOptions = {
  ...commonChartOptions,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0,0,0,0.05)'
      }
    },
    x: {
      grid: {
        color: 'rgba(0,0,0,0.05)'
      }
    }
  }
};

// Pie chart specific options
export const pieChartOptions = {
  ...commonChartOptions,
  cutout: '0%',
  radius: '90%',
  plugins: {
    ...commonChartOptions.plugins,
    legend: {
      ...commonChartOptions.plugins.legend,
      position: 'bottom'
    }
  },
  animation: {
    animateRotate: true,
    animateScale: true
  }
};

// Dataset styles
export const chartColors = {
  ok: '#67c23a',
  warning: '#e6a23c',
  fault: '#f56c6c',
  primary: '#1890ff'
};

// Apply global defaults
ChartJS.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
ChartJS.defaults.color = '#4b5563';
ChartJS.defaults.borderColor = 'rgba(0,0,0,0.1)';

// Register common components so pages don't need to repeat registration
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);
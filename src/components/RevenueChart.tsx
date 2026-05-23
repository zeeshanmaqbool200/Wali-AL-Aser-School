import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenueChartProps {
  data?: any[];
}

export default function RevenueChart({ data: propData }: RevenueChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Fallback to empty array if no data
  const chartData = propData || [];

  return (
    <Box sx={{ width: '100%', height: 350, pt: 2 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.palette.secondary.main} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={theme.palette.secondary.main} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            vertical={false} 
            stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} 
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 600 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 600 }}
            tickFormatter={(value) => `₹${value/1000}k`}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: isDark ? '#111' : '#fff',
              borderRadius: 16,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              padding: '12px'
            }}
            formatter={(value) => [`₹${value}`, '']}
            itemStyle={{ fontWeight: 700 }}
          />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            name="Revenue"
            stroke={theme.palette.primary.main} 
            strokeWidth={4}
            fillOpacity={1} 
            fill="url(#colorRevenue)" 
            animationDuration={2000}
          />
          <Area 
            type="monotone" 
            dataKey="expense" 
            name="Expenses"
            stroke={theme.palette.secondary.main} 
            strokeWidth={4}
            fillOpacity={1} 
            fill="url(#colorExpenses)" 
            animationDuration={2500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

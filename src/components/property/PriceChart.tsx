import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PriceChart: React.FC = () => {
  // Mock price data
  const priceData = {
    '1D': [
      { time: '9:00', price: 248 },
      { time: '12:00', price: 251 },
      { time: '15:00', price: 249 },
      { time: '18:00', price: 252 },
    ],
    '7D': [
      { time: 'Mon', price: 245 },
      { time: 'Tue', price: 248 },
      { time: 'Wed', price: 251 },
      { time: 'Thu', price: 249 },
      { time: 'Fri', price: 252 },
      { time: 'Sat', price: 250 },
      { time: 'Sun', price: 252 },
    ],
    '30D': [
      { time: 'Week 1', price: 240 },
      { time: 'Week 2', price: 245 },
      { time: 'Week 3', price: 248 },
      { time: 'Week 4', price: 252 },
    ],
    '1Y': [
      { time: 'Q1', price: 220 },
      { time: 'Q2', price: 235 },
      { time: 'Q3', price: 245 },
      { time: 'Q4', price: 252 },
    ],
    'All': [
      { time: '2022', price: 200 },
      { time: '2023', price: 225 },
      { time: '2024', price: 252 },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Price Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="7D" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="1D">1D</TabsTrigger>
            <TabsTrigger value="7D">7D</TabsTrigger>
            <TabsTrigger value="30D">30D</TabsTrigger>
            <TabsTrigger value="1Y">1Y</TabsTrigger>
            <TabsTrigger value="All">All</TabsTrigger>
          </TabsList>
          
          {Object.entries(priceData).map(([period, data]) => (
            <TabsContent key={period} value={period}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      className="text-muted-foreground"
                      domain={['dataMin - 5', 'dataMax + 5']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value) => [`$${value}`, 'Price']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PriceChart;
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, MapPin, Users, DollarSign } from 'lucide-react';
import { PropertyDetail } from '../../pages/PropertyDetail';

interface MarketTabProps {
  property: PropertyDetail;
}

const MarketTab: React.FC<MarketTabProps> = ({ property }) => {
  // Mock market data
  const regionPriceData = [
    { year: '2020', price: 180000 },
    { year: '2021', price: 195000 },
    { year: '2022', price: 210000 },
    { year: '2023', price: 235000 },
    { year: '2024', price: 255000 },
  ];

  const demandMetrics = [
    { metric: 'Inventory', value: 2.1, unit: 'months', status: 'low' },
    { metric: 'Days on Market', value: 18, unit: 'days', status: 'fast' },
    { metric: 'Price per Sq Ft', value: 215, unit: '$', status: 'growing' },
    { metric: 'Rental Demand', value: 92, unit: '%', status: 'high' },
  ];

  const neighborhoodComps = [
    { address: '125 Main St', price: 248000, sqft: 1150, pricePerSqft: 216 },
    { address: '130 Oak Ave', price: 265000, sqft: 1300, pricePerSqft: 204 },
    { address: '118 Pine St', price: 242000, sqft: 1100, pricePerSqft: 220 },
    { address: '135 Elm Dr', price: 258000, sqft: 1250, pricePerSqft: 206 },
  ];

  const propertyUpdates = [
    {
      date: '2024-01-15',
      title: 'New HVAC System Installation',
      description: 'Upgraded to energy-efficient HVAC system, expected to reduce utility costs by 15%.',
      impact: 'positive',
    },
    {
      date: '2024-01-08',
      title: 'Quarterly Distribution Paid',
      description: 'Q4 2023 rental income distributed to token holders: $4.50 per token.',
      impact: 'positive',
    },
    {
      date: '2023-12-20',
      title: 'Property Management Report',
      description: 'Annual property inspection completed. All systems in excellent condition.',
      impact: 'neutral',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Market Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5" />
            <span>Austin, TX Real Estate Market</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{property.marketData.regionGrowth}%</div>
              <div className="text-sm text-muted-foreground">YoY Growth</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{property.marketData.priceAppreciation}%</div>
              <div className="text-sm text-muted-foreground">5-Year Appreciation</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{property.marketData.demandIndex}</div>
              <div className="text-sm text-muted-foreground">Demand Index</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {demandMetrics.map((metric, index) => (
              <div key={index} className="p-3 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">{metric.metric}</div>
                <div className="text-lg font-bold">
                  {metric.value}
                  <span className="text-sm font-normal ml-1">{metric.unit}</span>
                </div>
                <Badge 
                  variant={metric.status === 'low' || metric.status === 'fast' ? 'default' : 'secondary'}
                  className="text-xs mt-1"
                >
                  {metric.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Price Appreciation Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Price Appreciation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={regionPriceData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="year" 
                  axisLine={false}
                  tickLine={false}
                  className="text-muted-foreground"
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Median Price']}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 5 }}
                  activeDot={{ r: 7, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Comparable Properties */}
      <Card>
        <CardHeader>
          <CardTitle>Neighborhood Comparables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {neighborhoodComps.map((comp, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <div className="font-medium">{comp.address}</div>
                  <div className="text-sm text-muted-foreground">{comp.sqft} sq ft</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">${comp.price.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">${comp.pricePerSqft}/sq ft</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Property Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Property Updates & Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {propertyUpdates.map((update, index) => (
              <div key={index} className="border-l-4 border-primary pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{update.title}</h4>
                  <span className="text-sm text-muted-foreground">{update.date}</span>
                </div>
                <p className="text-sm text-muted-foreground">{update.description}</p>
                <Badge 
                  variant={update.impact === 'positive' ? 'default' : 'secondary'}
                  className="mt-2"
                >
                  {update.impact === 'positive' ? 'Positive Impact' : 'Update'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Market Analysis Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium mb-2">Market Analysis Summary</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Austin\'s downtown real estate market shows strong fundamentals with consistent growth, 
                low inventory, and high rental demand. The area benefits from tech industry growth, 
                population influx, and ongoing urban development projects.
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Population growth: 2.5% annually</p>
                <p>• Job market growth: 3.8% annually</p>
                <p>• New development pipeline: $2.1B investment</p>
                <p>• Transportation improvements planned for 2025</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketTab;
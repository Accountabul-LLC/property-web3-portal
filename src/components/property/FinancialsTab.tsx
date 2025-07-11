import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Slider } from '../ui/slider';
import { Button } from '../ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PropertyDetail } from '../../pages/PropertyDetail';

interface FinancialsTabProps {
  property: PropertyDetail;
}

const FinancialsTab: React.FC<FinancialsTabProps> = ({ property }) => {
  const [tokenQuantity, setTokenQuantity] = React.useState(10);
  
  const investmentValue = tokenQuantity * property.pricePerToken;
  const annualReturn = investmentValue * (property.projectedAnnualReturn / 100);

  // Mock cash flow projections
  const cashFlowData = [
    { year: 'Year 1', value: annualReturn * 1 },
    { year: 'Year 5', value: annualReturn * 5.5 },
    { year: 'Year 10', value: annualReturn * 12 },
    { year: 'Year 20', value: annualReturn * 28 },
    { year: 'Year 30', value: annualReturn * 45 },
  ];

  // Mock investment value over time
  const investmentGrowthData = [
    { year: 'Year 1', value: investmentValue * 1.08 },
    { year: 'Year 5', value: investmentValue * 1.47 },
    { year: 'Year 10', value: investmentValue * 2.16 },
    { year: 'Year 20', value: investmentValue * 4.66 },
    { year: 'Year 30', value: investmentValue * 10.06 },
  ];

  return (
    <div className="space-y-6">
      {/* Investment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Raise</span>
                <span className="font-medium">${property.financials.totalRaise.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asset Value</span>
                <span className="font-medium">${property.financials.assetValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Closing Costs</span>
                <span className="font-medium">${property.financials.closingCosts.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operating Reserves</span>
                <span className="font-medium">${property.financials.operatingReserves.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cap Rate</span>
                <span className="font-medium text-success">{property.financials.capRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Annual Income</span>
                <span className="font-medium text-primary">${property.financials.annualIncome.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <h4 className="font-medium mb-4">Cost Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property Purchase</span>
                <span>${property.financials.assetValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Closing & Legal</span>
                <span>${property.financials.closingCosts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee</span>
                <span>$2,500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reserve Fund</span>
                <span>${property.financials.operatingReserves.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Purchase Calculator */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-medium">Number of Tokens</label>
              <span className="text-lg font-bold">{tokenQuantity} tokens</span>
            </div>
            <Slider
              value={[tokenQuantity]}
              onValueChange={(value) => setTokenQuantity(value[0])}
              max={Math.min(100, property.tokensAvailable)}
              min={1}
              step={1}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Total Investment</div>
              <div className="text-xl font-bold">${investmentValue.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Annual Returns</div>
              <div className="text-xl font-bold text-success">${annualReturn.toLocaleString()}</div>
            </div>
          </div>

          <Button className="w-full bg-gradient-primary">
            Calculate Detailed Projections
          </Button>
        </CardContent>
      </Card>

      {/* Cash Flow Projections */}
      <Card>
        <CardHeader>
          <CardTitle>Projected Cash Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData}>
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
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Cumulative Returns']}
                />
                <Bar 
                  dataKey="value" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Investment Value Growth */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Value Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={investmentGrowthData}>
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
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Investment Value']}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--success))', strokeWidth: 0, r: 5 }}
                  activeDot={{ r: 7, stroke: 'hsl(var(--success))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialsTab;
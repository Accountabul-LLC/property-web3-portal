import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

const OrderBook: React.FC = () => {
  const [orderType, setOrderType] = React.useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = React.useState('');
  const [quantity, setQuantity] = React.useState('');

  // Mock order book data
  const buyOrders = [
    { price: 251, quantity: 50, total: 12550 },
    { price: 250, quantity: 100, total: 25000 },
    { price: 249, quantity: 75, total: 18675 },
    { price: 248, quantity: 200, total: 49600 },
  ];

  const sellOrders = [
    { price: 253, quantity: 25, total: 6325 },
    { price: 254, quantity: 80, total: 20320 },
    { price: 255, quantity: 150, total: 38250 },
    { price: 256, quantity: 60, total: 15360 },
  ];

  // Mock recent trades
  const recentTrades = [
    { time: '14:32:15', price: 252, quantity: 25, side: 'buy' },
    { time: '14:31:42', price: 251, quantity: 50, side: 'sell' },
    { time: '14:30:18', price: 252, quantity: 30, side: 'buy' },
    { time: '14:28:56', price: 250, quantity: 100, side: 'sell' },
    { time: '14:27:33', price: 251, quantity: 40, side: 'buy' },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Trade Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Trade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Order Type Selection */}
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Button
                  variant={orderType === 'buy' ? 'default' : 'outline'}
                  onClick={() => setOrderType('buy')}
                  className="flex-1"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Buy
                </Button>
                <Button
                  variant={orderType === 'sell' ? 'default' : 'outline'}
                  onClick={() => setOrderType('sell')}
                  className="flex-1"
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Sell
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Price per Token</label>
                  <Input
                    type="number"
                    placeholder="252.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Quantity</label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: ${(Number(price) * Number(quantity) || 0).toLocaleString()}
                </div>
                <Button className="w-full" disabled={!price || !quantity}>
                  Place {orderType === 'buy' ? 'Buy' : 'Sell'} Order
                </Button>
              </div>
            </div>

            {/* Market Summary */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-success/10 rounded-lg">
                  <div className="text-sm text-muted-foreground">Best Bid</div>
                  <div className="text-lg font-bold text-success">$251</div>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <div className="text-sm text-muted-foreground">Best Ask</div>
                  <div className="text-lg font-bold text-destructive">$253</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Spread</div>
                  <div className="font-medium">$2 (0.8%)</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">24h Volume</div>
                  <div className="font-medium">$12,500</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Book Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buy Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-success">Buy Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Price</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyOrders.map((order, index) => (
                  <TableRow key={index} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium text-success">${order.price}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>${order.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sell Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Sell Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Price</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellOrders.map((order, index) => (
                  <TableRow key={index} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium text-destructive">${order.price}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>${order.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Side</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTrades.map((trade, index) => (
                <TableRow key={index}>
                  <TableCell className="text-muted-foreground">{trade.time}</TableCell>
                  <TableCell className="font-medium">${trade.price}</TableCell>
                  <TableCell>{trade.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'}>
                      {trade.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderBook;
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useTokenOrders } from '@/hooks/usePropertyData';
import { useParams } from 'react-router-dom';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useKycStatus } from '@/hooks/useKycStatus';
import { useWalletRegistration } from '@/hooks/useWalletRegistration';
import PrototypeNotice from '@/components/PrototypeNotice';
import { PROTOTYPE_DISABLED_LABEL } from '@/lib/prototypeSafety';

const OrderBook: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [orderType, setOrderType] = React.useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = React.useState('');
  const [quantity, setQuantity] = React.useState('');

  const { data: orders = [], isLoading } = useTokenOrders(id);
  const { activeAddress } = useActiveWallet();
  const { isApproved: kycApproved } = useKycStatus();
  const { isRegistered, isPending } = useWalletRegistration(activeAddress);

  // Order placement is not implemented in this prototype. The control stays
  // visible so the intended flow is clear, but it can never be submitted.
  const orderButtonLabel = `Place ${orderType === 'buy' ? 'buy' : 'sell'} order (${PROTOTYPE_DISABLED_LABEL})`;
  const orderButtonDisabled = true;

  const buyOrders = orders.filter(o => o.side === 'buy').sort((a, b) => b.price - a.price);
  const sellOrders = orders.filter(o => o.side === 'sell').sort((a, b) => a.price - b.price);

  const bestBid = buyOrders[0]?.price;
  const bestAsk = sellOrders[0]?.price;

  return (
    <div className="space-y-6">
      {/* Quick Trade Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Trade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Button variant={orderType === 'buy' ? 'default' : 'outline'} onClick={() => setOrderType('buy')} className="flex-1">
                  <TrendingUp className="w-4 h-4 mr-2" /> Buy
                </Button>
                <Button variant={orderType === 'sell' ? 'default' : 'outline'} onClick={() => setOrderType('sell')} className="flex-1">
                  <TrendingDown className="w-4 h-4 mr-2" /> Sell
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Price per Token</label>
                  <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Quantity</label>
                  <Input type="number" placeholder="10" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: ${(Number(price) * Number(quantity) || 0).toLocaleString()}
                </div>
                <Button className="w-full" disabled={orderButtonDisabled} aria-disabled="true">
                  {orderButtonLabel}
                </Button>
                <PrototypeNotice variant="inline">
                  Order placement is not connected to any exchange or ledger. Prices shown below are placeholder
                  records stored in the app database, not live market data.
                </PrototypeNotice>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-success/10 rounded-lg">
                  <div className="text-sm text-muted-foreground">Best Bid</div>
                  <div className="text-lg font-bold text-success">{bestBid ? `$${bestBid}` : '-'}</div>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <div className="text-sm text-muted-foreground">Best Ask</div>
                  <div className="text-lg font-bold text-destructive">{bestAsk ? `$${bestAsk}` : '-'}</div>
                </div>
              </div>
              {bestBid && bestAsk && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Spread</div>
                    <div className="font-medium">${(bestAsk - bestBid).toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-success">Buy Orders</CardTitle></CardHeader>
            <CardContent>
              {buyOrders.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No buy orders</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Price</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buyOrders.map((order) => (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium text-success">${order.price}</TableCell>
                        <TableCell>{order.quantity - order.filled_quantity}</TableCell>
                        <TableCell>${((order.quantity - order.filled_quantity) * order.price).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-destructive">Sell Orders</CardTitle></CardHeader>
            <CardContent>
              {sellOrders.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No sell orders</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Price</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellOrders.map((order) => (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium text-destructive">${order.price}</TableCell>
                        <TableCell>{order.quantity - order.filled_quantity}</TableCell>
                        <TableCell>${((order.quantity - order.filled_quantity) * order.price).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OrderBook;

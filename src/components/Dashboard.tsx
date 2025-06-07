import React, { useEffect, useState } from 'react';
import { supabase, type Debt } from '../lib/supabase';
import { DebtCard } from './DebtCard';
import { DebtTimeline } from './DebtTimeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  TrendingUp, 
  Mail, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  BarChart3
} from 'lucide-react';

export function Dashboard() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDebts: 0,
    totalAmount: 0,
    projectedSavings: 0,
    settledCount: 0
  });

  useEffect(() => {
    fetchDebts();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [debts]);

  const fetchDebts = async () => {
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDebts(data || []);
    } catch (error) {
      console.error('Error fetching debts:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('debts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debts'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setDebts(prev => [payload.new as Debt, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setDebts(prev => 
              prev.map(debt => 
                debt.id === payload.new.id ? payload.new as Debt : debt
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setDebts(prev => prev.filter(debt => debt.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const calculateStats = () => {
    const totalDebts = debts.length;
    const totalAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);
    const projectedSavings = debts.reduce((sum, debt) => sum + debt.projected_savings, 0);
    const settledCount = debts.filter(debt => debt.status === 'settled').length;

    setStats({
      totalDebts,
      totalAmount,
      projectedSavings,
      settledCount
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const groupedDebts = {
    all: debts,
    active: debts.filter(debt => ['received', 'negotiating'].includes(debt.status)),
    settled: debts.filter(debt => debt.status === 'settled'),
    failed: debts.filter(debt => ['failed', 'opted_out'].includes(debt.status))
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-lg">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            InboxNegotiator Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            AI-powered debt resolution platform with real-time updates
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Debts</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDebts}</div>
              <p className="text-xs text-muted-foreground">
                Emails processed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">
                Across all debts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projected Savings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.projectedSavings)}
              </div>
              <p className="text-xs text-muted-foreground">
                From negotiations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Settled Cases</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.settledCount}</div>
              <p className="text-xs text-muted-foreground">
                Successfully resolved
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="flex items-center gap-2">
              All Debts
              <Badge variant="secondary" className="ml-1">
                {groupedDebts.all.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              Active
              <Badge variant="secondary" className="ml-1">
                {groupedDebts.active.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="settled" className="flex items-center gap-2">
              Settled
              <Badge variant="secondary" className="ml-1">
                {groupedDebts.settled.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-2">
              Failed/Opted Out
              <Badge variant="secondary" className="ml-1">
                {groupedDebts.failed.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {Object.entries(groupedDebts).map(([key, debtList]) => (
            <TabsContent key={key} value={key} className="space-y-6">
              {debtList.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No debts found</h3>
                    <p className="text-gray-600 text-center max-w-md">
                      {key === 'all' 
                        ? 'Forward your first debt email to get started with automated negotiations.'
                        : `No debts with ${key} status found.`
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {debtList.map((debt) => (
                    <div key={debt.id} className="space-y-4">
                      <DebtCard debt={debt} />
                      <Card className="bg-gray-50">
                        <CardContent className="p-4">
                          <DebtTimeline debt={debt} />
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Footer */}
        <Separator className="my-8" />
        <div className="text-center text-sm text-gray-600">
          <p>InboxNegotiator - FDCPA-compliant debt resolution platform</p>
          <p className="mt-1">Real-time updates powered by Supabase</p>
        </div>
      </div>
    </div>
  );
}
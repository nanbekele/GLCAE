import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MetricPoint {
  period: string;
  value: number;
}

interface AnalyticsData {
  label: string;
  total: number;
  change: number;
  positive: boolean;
  series: MetricPoint[];
}

const sampleData: AnalyticsData[] = [
  {
    label: 'Website sessions',
    total: 12840,
    change: 6.2,
    positive: true,
    series: [
      { period: 'Week 1', value: 2800 },
      { period: 'Week 2', value: 3000 },
      { period: 'Week 3', value: 3250 },
      { period: 'Week 4', value: 3790 },
    ],
  },
  {
    label: 'News article reads',
    total: 5460,
    change: -3.5,
    positive: false,
    series: [
      { period: 'Week 1', value: 1500 },
      { period: 'Week 2', value: 1420 },
      { period: 'Week 3', value: 1360 },
      { period: 'Week 4', value: 1180 },
    ],
  },
  {
    label: 'Contact enquiries',
    total: 82,
    change: 11.0,
    positive: true,
    series: [
      { period: 'Week 1', value: 20 },
      { period: 'Week 2', value: 18 },
      { period: 'Week 3', value: 17 },
      { period: 'Week 4', value: 27 },
    ],
  },
];

const chartColors = {
  line: 'stroke-primary',
  fill: 'fill-primary/20',
};

const MarketingAnalytics = () => {
  const [selectedMetric, setSelectedMetric] = useState(sampleData[0].label);
  const [timeframe, setTimeframe] = useState<'4w' | '12w' | '12m'>('4w');

  const metric = useMemo(() => sampleData.find(item => item.label === selectedMetric) ?? sampleData[0], [selectedMetric]);

  const simulatedSeries = useMemo(() => {
    if (timeframe === '4w') return metric.series;
    if (timeframe === '12w') {
      return Array.from({ length: 12 }).map((_, index) => ({
        period: `Week ${index + 1}`,
        value: Math.max(0, Math.round(metric.series[Math.min(metric.series.length - 1, index % metric.series.length)].value * (0.7 + Math.random() * 0.6))),
      }));
    }
    return Array.from({ length: 12 }).map((_, index) => ({
      period: new Date(0, index).toLocaleString('default', { month: 'short' }),
      value: Math.max(0, Math.round(metric.series[Math.min(metric.series.length - 1, index % metric.series.length)].value * (0.4 + Math.random() * 0.8))),
    }));
  }, [metric, timeframe]);

  const totalChange = metric.change;
  const TotalIcon = metric.positive ? TrendingUp : TrendingDown;
  const ChangeIcon = totalChange >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
            <p className="text-muted-foreground max-w-2xl">
              Track marketing reach across the website, content hub and contact funnels. Use these
              snapshots to decide where to invest the next campaign.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Metric</Label>
              <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {sampleData.map(item => (
                    <SelectItem key={item.label} value={item.label}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Timeframe</Label>
              <Select value={timeframe} onValueChange={(value) => setTimeframe(value as typeof timeframe)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Last 4 weeks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4w">Last 4 weeks</SelectItem>
                  <SelectItem value="12w">Last 12 weeks</SelectItem>
                  <SelectItem value="12m">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Card className="shadow-corporate border-card-border">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <TotalIcon className={metric.positive ? 'text-green-600' : 'text-destructive'} size={20} />
                {metric.total.toLocaleString()} {metric.label}
              </CardTitle>
              <CardDescription>Aggregate performance for the selected metric.</CardDescription>
            </div>
            <Badge variant={metric.positive ? 'default' : 'destructive'} className="flex items-center gap-1">
              <ChangeIcon size={16} />
              {Math.abs(totalChange).toFixed(1)}%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 text-left">Period</th>
                    <th className="px-3 py-2 text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {simulatedSeries.map((point) => (
                    <tr key={point.period} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-foreground">{point.period}</td>
                      <td className="px-3 py-2 text-muted-foreground">{point.value.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle>Insights & Recommendations</CardTitle>
            <CardDescription>Use these cues when building the next campaign plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-border rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Channels driving growth</h3>
                <p className="text-sm text-muted-foreground">
                  Website sessions grew {metric.positive ? 'thanks to engagements' : 'despite lower engagements'} from
                  the new front-page banner and social referrals. Continue A/B testing hero copy.
                </p>
              </div>
              <div className="border border-border rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Content health</h3>
                <p className="text-sm text-muted-foreground">
                  News reads dipped slightly. Repurpose high-performing project updates into thought-leadership
                  posts to re-engage the engineering community.
                </p>
              </div>
              <div className="border border-border rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Lead pipeline</h3>
                <p className="text-sm text-muted-foreground">
                  Contact enquiries are trending upward. Prioritise follow-ups within 48 hours to maintain momentum.
                </p>
              </div>
              <div className="border border-border rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Next actions</h3>
                <p className="text-sm text-muted-foreground">
                  Schedule a quarterly analytics review with the marketing & BD team to align upcoming events with
                  areas showing the strongest demand.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketingAnalytics;

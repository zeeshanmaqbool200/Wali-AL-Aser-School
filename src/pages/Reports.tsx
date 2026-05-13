import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Stack, Divider, Paper, useTheme, alpha,
  LinearProgress, Tab, Tabs, Container, IconButton
} from '@mui/material';
import { 
  BarChart3, TrendingUp, TrendingDown, Calendar, 
  Download, Filter, FileText, PieChart, GraduationCap, 
  Users, Briefcase, Wallet, ArrowUpRight, ArrowDownRight, 
  Activity, IndianRupee, AlertCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
  AreaChart, Area, LineChart, Line
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { collection, query, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#0d9488', '#0ea5e9', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

export default function Reports() {
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'manager' || currentUser?.role === 'superadmin' || currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    fees: 0,
    credits: 0,
    debits: 0,
    students: 0,
    staff: 0,
    pendingUsers: 0
  });

  useEffect(() => {
    if (!currentUser || !isAdmin) return;
    setLoading(true);
    
    const unsubscribes: (() => void)[] = [];
    
    // Financial Data
    const qFees = query(collection(db, 'receipts'));
    const unsubFees = onSnapshot(qFees, (snapshot) => {
      const receipts = snapshot.docs.map(doc => doc.data());
      const filtered = receipts.filter(r => {
        if (!r.date) return true;
        return isWithinInterval(new Date(r.date), { start: new Date(startDate), end: new Date(endDate) });
      });
      
      const totalFees = filtered.reduce((acc, r) => acc + (r.amount || 0), 0);
      setCounts(prev => ({ ...prev, fees: totalFees }));
      
      const monthly: Record<string, { revenue: number, expenses: number }> = {};
      filtered.forEach(r => {
        const month = format(new Date(r.date), 'MMM yyyy');
        if (!monthly[month]) monthly[month] = { revenue: 0, expenses: 0 };
        monthly[month].revenue += (r.amount || 0);
      });
      
      setRevenueData(Object.keys(monthly).map(key => ({
        name: key,
        revenue: monthly[key].revenue,
        expenses: monthly[key].expenses
      })).sort((a,b) => new Date(a.name).getTime() - new Date(b.name).getTime()));
    });
    unsubscribes.push(unsubFees);

    const qLedger = query(collection(db, 'ledger'));
    const unsubLedger = onSnapshot(qLedger, (snapshot) => {
      const entries = snapshot.docs.map(doc => doc.data());
      const filtered = entries.filter(e => {
          if (!e.date) return true;
          return isWithinInterval(new Date(e.date), { start: new Date(startDate), end: new Date(endDate) });
      });
      
      const credits = filtered.filter(e => e.type === 'credit').reduce((acc, e) => acc + (e.amount || 0), 0);
      const debits = filtered.filter(e => e.type === 'debit').reduce((acc, e) => acc + (e.amount || 0), 0);
      
      setCounts(prev => ({ ...prev, credits, debits }));
    });
    unsubscribes.push(unsubLedger);

    // Snapshot counts
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setCounts(prev => ({
        ...prev,
        students: list.filter(u => u.role === 'student').length,
        staff: list.filter(u => ['teacher', 'manager', 'superadmin'].includes(u.role)).length,
        pendingUsers: list.filter(u => !u.isVerified).length
      }));
    });
    unsubscribes.push(unsubUsers);
    
    setLoading(false);
    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser?.uid, isAdmin, startDate, endDate]);

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text('MAKTAB WALI UL ASER', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Institutional Performance & Financial Report', 105, 25, { align: 'center' });
    
    autoTable(doc, {
      startY: 35,
      head: [['Metric', 'Value']],
      body: [
        ['Inflow (Fees)', `Rs.${counts.fees.toLocaleString()}`],
        ['Other Credits', `Rs.${counts.credits.toLocaleString()}`],
        ['Outflow (Expenses)', `Rs.${counts.debits.toLocaleString()}`],
        ['Net Balance', `Rs.${(counts.fees + counts.credits - counts.debits).toLocaleString()}`]
      ],
      headStyles: { fillColor: [13, 148, 136] }
    });

    doc.save(`WaliUlAsr_Institutional_Insight_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleReportClick = (report: any) => {
    if (report.action) {
      report.action();
    } else if (report.page) {
      navigate(report.page);
    }
  };

  const availableReports = [
    { title: 'Academic Summary', icon: <GraduationCap size={22} />, type: 'ANALYSIS', color: 'primary', action: () => setActiveTab('academic') },
    { title: 'Institutional Ledger', icon: <Briefcase size={22} />, type: 'RECORDS', color: 'success', page: '/expenses' },
    { title: 'Fee Status Log', icon: <IndianRupee size={22} />, type: 'FINANCE', color: 'warning', page: '/fees' },
    { title: 'Logistics / Assets', icon: <Activity size={22} />, type: 'PDF', color: 'error', action: handleDownloadPDF }
  ];

  const financialStats = [
    { title: 'Inflow (Fees)', value: `Rs.${counts.fees.toLocaleString()}`, trend: 'Verified Receipts', icon: <Wallet size={24} />, color: 'primary', link: '/fees' },
    { title: 'Other Credits', value: `Rs.${counts.credits.toLocaleString()}`, trend: 'Misc Income', icon: <ArrowUpRight size={24} />, color: 'success', link: '/expenses' },
    { title: 'Outflow (Expenses)', value: `Rs.${counts.debits.toLocaleString()}`, trend: 'Ledger Records', icon: <ArrowDownRight size={24} />, color: 'error', link: '/expenses' },
    { title: 'Total Net Balance', value: `Rs.${(counts.fees + counts.credits - counts.debits).toLocaleString()}`, trend: 'Current Liquidity', icon: <Activity size={24} />, color: 'warning' }
  ];

  if (!isAdmin) {
    return (
      <Container maxWidth="md" sx={{ mt: 10, textAlign: 'center' }}>
        <Paper sx={{ p: 6, borderRadius: 4 }}>
          <FileText size={64} color={theme.palette.error.main} style={{ marginBottom: 24, opacity: 0.5 }} />
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>Access Restricted</Typography>
          <Typography variant="body1" color="text.secondary">You do not have permission to view institutional reports.</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ pb: 8 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: -1.5, mb: 1 }}>Insights & Analytics</Typography>
          <Typography variant="body1" sx={{ fontWeight: 800, color: 'text.secondary', opacity: 0.8 }}>System-wide performance monitoring and financial intelligence</Typography>
        </Box>
        <Stack direction="row" spacing={2}>
           <Button variant="outlined" startIcon={<Download size={18} />} sx={{ borderRadius: 2.5, fontWeight: 800 }}>Export CSV</Button>
           <Button variant="contained" startIcon={<Activity size={18} />} sx={{ borderRadius: 2.5, fontWeight: 900 }}>Real-time Feed</Button>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 4, height: 6, borderRadius: 3 }} />}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {availableReports.map((report, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Card 
              variant="outlined" 
              onClick={() => handleReportClick(report)}
              sx={{ 
                cursor: 'pointer', 
                borderRadius: 4, 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { transform: 'translateY(-5px)', borderColor: `${report.color}.main`, boxShadow: `0 10px 30px ${alpha(theme.palette[report.color as 'primary'].main, 0.1)}` }
              }}
            >
              <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2.5 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette[report.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.1), color: `${report.color}.main` }}>
                  {report.icon}
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', mb: 0.2 }}>{report.type}</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.1 }}>{report.title}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {financialStats.map((stat, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Card sx={{ 
              borderRadius: 4, 
              bgcolor: stat.color === 'warning' ? alpha(theme.palette.warning.main, 0.05) : 'background.paper',
              height: '100%' 
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                   <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette[stat.color as 'primary'].main, 0.1), color: `${stat.color}.main` }}>{stat.icon}</Box>
                   {stat.link && <IconButton size="small" onClick={() => navigate(stat.link!)}><ArrowUpRight size={18} /></IconButton>}
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: -1, mb: 0.5 }}>{stat.value}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {stat.title}
                </Typography>
                <Typography variant="caption" sx={{ mt: 1, display: 'block', fontWeight: 800, color: `${stat.color}.main`, opacity: 0.8 }}>{stat.trend}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
         <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ borderRadius: 4, p: 4, height: '100%' }}>
               <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                 <BarChart3 size={24} color={theme.palette.primary.main} /> Cash Flow Overview
               </Typography>
               <Box sx={{ height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.1}/>
                          <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 12, fill: theme.palette.text.secondary }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 12, fill: theme.palette.text.secondary }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 800 }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke={theme.palette.primary.main} strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </Box>
            </Card>
         </Grid>
         <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 4, p: 4, height: '100%' }}>
               <Typography variant="h6" sx={{ fontWeight: 900, mb: 4 }}>Resource Allocation</Typography>
               <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                       <Typography variant="body2" sx={{ fontWeight: 800 }}>Student Coverage</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 900, color: 'primary.main' }}>84%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={84} sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                       <Typography variant="body2" sx={{ fontWeight: 800 }}>Fee Recovery Rate</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 900, color: 'success.main' }}>72%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={72} color="success" sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                       <Typography variant="body2" sx={{ fontWeight: 800 }}>Asset Utilization</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 900, color: 'warning.main' }}>91%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={91} color="warning" sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
               </Box>

               <Divider sx={{ my: 4 }} />

               <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2, color: 'text.secondary' }}>System Notifications</Typography>
               <Stack spacing={2}>
                  {counts.pendingUsers > 0 && (
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.warning.main, 0.1), border: '1px solid', borderColor: alpha(theme.palette.warning.main, 0.2) }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AlertCircle size={14} /> {counts.pendingUsers} NEW ADMISSIONS PENDING
                      </Typography>
                    </Box>
                  )}
               </Stack>
            </Card>
         </Grid>
      </Grid>
    </Box>
  );
}

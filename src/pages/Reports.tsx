import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Stack, Divider, Paper, useTheme, alpha,
  LinearProgress, Tab, Tabs, Container, IconButton, useMediaQuery
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
import { useData } from '../context/DataContext';
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
  const { receipts: allReceipts, users: allUsers, expenses: allExpenses, loading: contextLoading } = useData();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isAdmin = currentUser?.role === 'manager' || currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin' || currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    fees: 0,
    credits: 0,
    debits: 0,
    students: 0,
    staff: 0,
    pendingUsers: 0
  });

  useEffect(() => {
    if (!isAdmin || contextLoading) return;
    
    // Financial Data from context
    const filteredReceipts = allReceipts.filter(r => {
      if (!r.date || r.status !== 'approved') return false;
      try {
        const rDate = new Date(r.date);
        return isWithinInterval(rDate, { start: new Date(startDate), end: new Date(endDate) });
      } catch (e) { return false; }
    });
    
    const totalFees = filteredReceipts.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    
    const monthly: Record<string, { revenue: number, expenses: number }> = {};
    filteredReceipts.forEach(r => {
      try {
        const month = format(new Date(r.date), 'MMM yyyy');
        if (!monthly[month]) monthly[month] = { revenue: 0, expenses: 0 };
        monthly[month].revenue += (Number(r.amount) || 0);
      } catch (e) {}
    });

    // Ledger Data from context
    const filteredExpenses = allExpenses.filter(e => {
      if (!e.date) return false;
      try {
        return isWithinInterval(new Date(e.date), { start: new Date(startDate), end: new Date(endDate) });
      } catch (e) { return false; }
    });
    
    const credits = filteredExpenses.filter(e => e.type === 'credit').reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const debits = filteredExpenses.filter(e => e.type === 'debit').reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    
    setCounts({
      fees: totalFees,
      credits,
      debits,
      students: allUsers.filter(u => (u.role === 'student' || !u.role) && u.status !== 'Archived').length,
      staff: allUsers.filter(u => ['teacher', 'manager', 'superadmin', 'admin'].includes(u.role || '')).length,
      pendingUsers: allUsers.filter(u => !u.isVerified && u.status !== 'Deleted' && u.status !== 'Archived').length
    });

    setRevenueData(Object.keys(monthly).map(key => ({
      name: key,
      revenue: monthly[key].revenue
    })).sort((a,b) => new Date(a.name).getTime() - new Date(b.name).getTime()));
    
    setLoading(false);
  }, [allReceipts, allUsers, allExpenses, isAdmin, startDate, endDate, contextLoading]);

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
        ['Total Inflow', `INR ${(counts.fees + counts.credits).toLocaleString()}`],
        ['Total Outflow', `INR ${counts.debits.toLocaleString()}`],
        ['Net Balance', `INR ${(counts.fees + counts.credits - counts.debits).toLocaleString()}`]
      ],
      headStyles: { fillColor: [13, 148, 136] }
    });

    doc.save(`Institutional_Insight_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
    { title: 'Total Inflow', value: `INR ${(counts.fees + counts.credits).toLocaleString()}`, trend: 'Fees & Misc Credits', icon: <Wallet size={24} />, color: 'primary' },
    { title: 'Total Outflow', value: `INR ${counts.debits.toLocaleString()}`, trend: 'Ledger Records', icon: <ArrowDownRight size={24} />, color: 'error', link: '/expenses' },
    { title: 'Total Net Balance', value: `INR ${(counts.fees + counts.credits - counts.debits).toLocaleString()}`, trend: 'Current Liquidity', icon: <Activity size={24} />, color: 'warning' }
  ];

  const coverageRate = counts.students > 0 ? Math.round(((counts.students - counts.pendingUsers) / counts.students) * 100) : 0;
  const recoveryRate = counts.students > 0 ? Math.min(Math.round((counts.fees / (counts.students * 1000)) * 100), 100) : 0; // Revised estimate 1k/student

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
          <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ fontWeight: 950, letterSpacing: -1.5, mb: 0.5, color: 'primary.main', textTransform: 'uppercase' }}>Insights & Analytics</Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', opacity: 0.8, letterSpacing: 1 }}>System-wide performance monitoring and financial intelligence</Typography>
        </Box>
        <Stack direction="row" spacing={2}>
           <Button variant="outlined" startIcon={<Download size={18} />} sx={{ borderRadius: 2.5, fontWeight: 800 }} onClick={() => exportToCSV(revenueData, 'revenue_report')}>Export CSV</Button>
           <Button variant="contained" startIcon={<Activity size={18} />} sx={{ borderRadius: 2.5, fontWeight: 900 }} onClick={() => window.location.reload()}>Real-time Feed</Button>
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
                <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -1, mb: 0.5 }}>{stat.value}</Typography>
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
                       <Typography variant="body2" sx={{ fontWeight: 800 }}>Student Verification</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 900, color: 'primary.main' }}>{coverageRate}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={coverageRate} sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                       <Typography variant="body2" sx={{ fontWeight: 800 }}>Fee Recovery Rate</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 900, color: 'success.main' }}>{recoveryRate}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={recoveryRate} color="success" sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                       <Typography variant="body2" sx={{ fontWeight: 800 }}>System Integrity</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 900, color: 'warning.main' }}>100%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={100} color="warning" sx={{ height: 8, borderRadius: 4 }} />
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

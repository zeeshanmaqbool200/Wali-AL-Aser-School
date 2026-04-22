import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  CircularProgress, IconButton, Chip, Avatar, 
  Divider, Paper, List, ListItem, ListItemText, 
  ListItemAvatar, Tooltip, Select, MenuItem, 
  FormControl, InputLabel, useTheme, alpha,
  Stack, Fade, Zoom
} from '@mui/material';
import { 
  Download, FileText, TrendingUp, Users, 
  BookOpen, Calendar, DollarSign, Filter,
  BarChart2, PieChart as PieChartIcon, Share2,
  Printer, Mail, FileSpreadsheet, ChevronRight,
  ArrowUpRight, ArrowDownRight, Sparkles,
  GraduationCap, Award, Briefcase, Activity
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend,
  AreaChart, Area
} from 'recharts';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#0d9488', '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4'];

export default function Reports() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('attendance');
  const [counts, setCounts] = useState({ students: 0, fees: 0, attendance: 0 });
  
  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isApprovedMudaris = currentUser?.role === 'approved_mudaris';

  useEffect(() => {
    // Real stats fetching
    const unsubscribeStudents = onSnapshot(collection(db, 'users'), (snapshot) => {
      const studentCount = snapshot.docs.filter(doc => doc.data().role === 'student').length;
      setCounts(prev => ({ ...prev, students: studentCount }));
    });

    const unsubscribeFees = onSnapshot(collection(db, 'receipts'), (snapshot) => {
      const totalAmount = snapshot.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setCounts(prev => ({ ...prev, fees: totalAmount }));
    });

    setLoading(false);
    return () => {
      unsubscribeStudents();
      unsubscribeFees();
    };
  }, []);

  // Reports filtering based on role
  const availableReports = [
    { title: 'Tulab Karkardagi Report', icon: <GraduationCap size={22} />, type: 'PDF', size: '2.4 MB', color: 'primary' },
    ...(isSuperAdmin ? [{ title: 'Fee Jama Summary', icon: <DollarSign size={22} />, type: 'XLSX', size: '1.1 MB', color: 'success' }] : []),
    { title: 'Mudaris Haziri Log', icon: <Users size={22} />, type: 'CSV', size: '0.8 MB', color: 'warning' },
    ...(isSuperAdmin ? [{ title: 'Asasa Report', icon: <FileText size={22} />, type: 'PDF', size: '3.2 MB', color: 'error' }] : []),
  ];

  const attendanceData = [
    { name: 'Mon', present: 45, absent: 5 },
    { name: 'Tue', present: 48, absent: 2 },
    { name: 'Wed', present: 42, absent: 8 },
    { name: 'Thu', present: 47, absent: 3 },
    { name: 'Fri', present: 44, absent: 6 },
    { name: 'Sat', present: 40, absent: 10 },
  ];

  const enrollmentData = [
    { name: 'Quran / Hifz', value: 400 },
    { name: 'Fiqh / Aqaid', value: 300 },
    { name: 'Tareekh / Seerat', value: 300 },
    { name: 'Akhlaq', value: 200 },
  ];

  const stats = [
    { title: 'Total Tulab-e-Ilm', value: counts.students.toLocaleString(), trend: '+0%', icon: <Users size={24} />, color: 'primary' },
    ...(isSuperAdmin ? [{ title: 'Majmua (MTD)', value: `₹${counts.fees.toLocaleString()}`, trend: '+0%', icon: <DollarSign size={24} />, color: 'success' }] : []),
    { title: 'Ausat Haziri', value: '94.2%', trend: '94%', icon: <Activity size={24} />, color: 'warning' },
    { title: 'Imtihan Kamyabi', value: '82.1%', trend: '82%', icon: <Award size={24} />, color: 'error' }
  ];

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Reports & Analytics</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Comprehensive insights into Maktab performance and official operations
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button 
              variant="outlined" 
              startIcon={<Printer size={18} />} 
              sx={{ 
                borderRadius: 2, 
                fontWeight: 900, 
                px: 4, 
                py: 1.5,
                textTransform: 'none',
                border: 'none',
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: theme.palette.mode === 'dark'
                  ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                  : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
                '&:hover': {
                  bgcolor: 'background.paper',
                  boxShadow: theme.palette.mode === 'dark'
                    ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                    : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                }
              }}
            >
              Print
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Download size={18} />} 
              sx={{ 
                borderRadius: 2, 
                fontWeight: 900, 
                px: 4, 
                py: 1.5,
                textTransform: 'none',
                boxShadow: theme.palette.mode === 'dark'
                  ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                  : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
              }}
            >
              Export All
            </Button>
          </Stack>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Quick Stats */}
        {stats.map((stat, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card sx={{ 
                borderRadius: 2, 
                border: 'none',
                bgcolor: 'background.paper',
                boxShadow: theme.palette.mode === 'dark'
                  ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
                  : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { 
                  transform: 'translateY(-8px)', 
                  boxShadow: theme.palette.mode === 'dark'
                    ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
                    : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
                }
              }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette[stat.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.1), 
                        color: `${stat.color}.main`, 
                        borderRadius: 4,
                        width: 56,
                        height: 56,
                        boxShadow: theme.palette.mode === 'dark'
                          ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                          : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                      }}
                    >
                      {stat.icon}
                    </Avatar>
                    <Chip 
                      label={stat.trend} 
                      size="small" 
                      sx={{ 
                        fontWeight: 900, 
                        borderRadius: 2, 
                        height: 24, 
                        bgcolor: alpha(theme.palette[stat.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.1), 
                        color: `${stat.color}.main`,
                        border: 'none'
                      }} 
                      icon={stat.trend.startsWith('+') ? <ArrowUpRight size={14} /> : undefined}
                    />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1 }}>{stat.value}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>{stat.title}</Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}

        {/* Charts */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ 
            borderRadius: 2, 
            border: 'none',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
              : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Haziri Trends</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Haftawar Tulab Haziri analysis</Typography>
              </Box>
              <FormControl 
                size="small" 
                sx={{ 
                  width: 150, 
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: 4, 
                    bgcolor: 'background.default',
                    '& fieldset': { border: 'none' },
                    boxShadow: theme.palette.mode === 'dark'
                      ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                      : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                  } 
                }}
              >
                <Select 
                  value={reportType} 
                  onChange={(e) => setReportType(e.target.value)}
                  sx={{ fontWeight: 800 }}
                >
                  <MenuItem value="attendance" sx={{ fontWeight: 700 }}>Weekly View</MenuItem>
                  <MenuItem value="monthly" sx={{ fontWeight: 700 }}>Monthly View</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ height: 350, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: theme.palette.text.secondary, fontWeight: 600, fontSize: 12 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: theme.palette.text.secondary, fontWeight: 600, fontSize: 12 }} 
                    />
                    <RechartsTooltip 
                      cursor={{ fill: alpha(theme.palette.primary.main, 0.05) }}
                      contentStyle={{ 
                        borderRadius: 12, 
                        border: 'none', 
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        padding: '12px'
                      }} 
                    />
                    <Bar dataKey="present" fill="url(#colorPresent)" radius={[6, 6, 0, 0]} barSize={40} />
                    <Bar dataKey="absent" fill={alpha(theme.palette.error.main, 0.4)} radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ 
            borderRadius: 2, 
            border: 'none',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
              : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
            height: '100%'
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Tulab Taqseem</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Mazameen ke mutabiq Tulab distribution</Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={enrollmentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {enrollmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} 
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span style={{ fontWeight: 700, color: theme.palette.text.primary, fontSize: '0.85rem' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : 'white' }}>
                    <Sparkles size={20} color={theme.palette.primary.main} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
                    Quran / Hifz stream has seen a 15% increase in enrollments this semester.
                  </Typography>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Reports List */}
        <Grid size={12}>
          <Box sx={{ mt: 4, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -1 }}>Available Reports</Typography>
            <Button variant="text" sx={{ fontWeight: 800 }}>View Archive</Button>
          </Box>
          <Grid container spacing={3}>
            {availableReports.map((report, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Paper 
                    sx={{ 
                      p: 2.5, 
                      borderRadius: 2, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2.5, 
                      border: 'none',
                      bgcolor: 'background.paper',
                      boxShadow: theme.palette.mode === 'dark'
                        ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                        : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': { 
                        transform: 'translateY(-5px)',
                        bgcolor: alpha(theme.palette[report.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.05),
                        cursor: 'pointer' 
                      } 
                    }}
                  >
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette[report.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.1), 
                        color: `${report.color}.main`, 
                        borderRadius: 2,
                        width: 48,
                        height: 48,
                        boxShadow: theme.palette.mode === 'dark'
                          ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                          : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                      }}
                    >
                      {report.icon}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.2 }}>{report.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        {report.type} • {report.size}
                      </Typography>
                    </Box>
                    <IconButton 
                      size="small" 
                      sx={{ 
                        bgcolor: 'background.default',
                        boxShadow: theme.palette.mode === 'dark'
                          ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                          : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                      }}
                    >
                      <Download size={18} />
                    </IconButton>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

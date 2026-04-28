import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, CircularProgress, IconButton, Chip,
  Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, InputAdornment,
  Stack, Tooltip, Collapse
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Search, Trash2, Filter, Calendar, Clock, 
  AlertCircle, CheckCircle, Info, Database,
  Shield, ChevronDown, ChevronUp, RefreshCw,
  Terminal, Zap, HardDrive, Cpu
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, limit, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { logger } from '../lib/logger';

interface SystemLog {
  id: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'db' | 'auth';
  message: string;
  data: any;
  timestamp: number;
  userAgent: string;
  ip?: string;
  location?: string;
  browser?: string;
  os?: string;
  device?: string;
  islamicDate?: string;
  userId?: string;
  userEmail?: string;
}

export default function AdminLogs() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(
      collection(db, 'access_logs'), 
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SystemLog[]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all access logs?')) return;
    
    try {
      const snapshot = await getDocs(collection(db, 'access_logs'));
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      logger.error('Error clearing logs', error as Error);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return theme.palette.error.main;
      case 'warn': return theme.palette.warning.main;
      case 'success': return theme.palette.success.main;
      case 'info': return theme.palette.info.main;
      case 'db': return '#ff6000';
      case 'auth': return '#6366f1';
      default: return theme.palette.text.secondary;
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle size={16} />;
      case 'warn': return <AlertCircle size={16} />;
      case 'success': return <CheckCircle size={16} />;
      case 'info': return <Info size={16} />;
      case 'db': return <Database size={16} />;
      case 'auth': return <Shield size={16} />;
      default: return <Terminal size={16} />;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (log.data && JSON.stringify(log.data).toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    return matchesSearch && matchesLevel;
  });

  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 10, textAlign: 'center' }}>
        <Shield size={64} color="error" style={{ marginBottom: 24, opacity: 0.2 }} />
        <Typography variant="h4" color="error" sx={{ fontWeight: 900, mb: 1 }}>Access Forbidden</Typography>
        <Typography variant="body1" color="text.secondary">Detailed security logs are only visible to the <strong>SUPER ADMIN</strong> of Wali Ul Aser Institute.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>System Logs</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Administrative review of application events and errors
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button 
              variant="outlined" 
              color="error" 
              startIcon={<Trash2 size={18} />} 
              onClick={handleClearLogs}
              sx={{ 
                borderRadius: 4, 
                fontWeight: 900, 
                px: 4, 
                py: 1.5,
                textTransform: 'none',
                border: 'none',
                bgcolor: 'background.paper',
                color: 'error.main',
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
              Clear Logs
            </Button>
            <Button 
              variant="contained" 
              startIcon={<RefreshCw size={18} />} 
              onClick={() => window.location.reload()}
              sx={{ 
                borderRadius: 4, 
                fontWeight: 900, 
                px: 4, 
                py: 1.5,
                textTransform: 'none',
                boxShadow: theme.palette.mode === 'dark'
                  ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                  : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
              }}
            >
              Refresh
            </Button>
          </Stack>
        </Box>
      </motion.div>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ 
            borderRadius: 5, 
            bgcolor: 'background.paper', 
            border: 'none',
            boxShadow: theme.palette.mode === 'dark'
              ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
              : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
          }}>
            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: alpha(theme.palette.primary.main, 0.1), 
              color: 'primary.main',
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}>
                <Zap size={24} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>Total Events</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{logs.length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ 
            borderRadius: 5, 
            bgcolor: 'background.paper', 
            border: 'none',
            boxShadow: theme.palette.mode === 'dark'
              ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
              : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
          }}>
            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: alpha(theme.palette.error.main, 0.1), 
              color: 'error.main',
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}>
                <AlertCircle size={24} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>Errors</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{logs.filter(l => l.level === 'error').length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ 
            borderRadius: 5, 
            bgcolor: 'background.paper', 
            border: 'none',
            boxShadow: theme.palette.mode === 'dark'
              ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
              : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
          }}>
            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: alpha('#ff6000', 0.1), 
              color: '#ff6000',
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}>
                <Database size={24} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>DB Operations</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{logs.filter(l => l.level === 'db').length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ 
            borderRadius: 5, 
            bgcolor: 'background.paper', 
            border: 'none',
            boxShadow: theme.palette.mode === 'dark'
              ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
              : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
          }}>
            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: alpha('#6366f1', 0.1), 
              color: '#6366f1',
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}>
                <Shield size={24} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>Auth Events</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{logs.filter(l => l.level === 'auth').length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ 
        borderRadius: 7, 
        overflow: 'hidden', 
        border: 'none',
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'dark'
          ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
          : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
      }}>
        <Box sx={{ 
          p: 3, 
          borderBottom: '1px solid', 
          borderColor: 'divider', 
          display: 'flex', 
          gap: 3, 
          flexWrap: 'wrap', 
          alignItems: 'center',
          bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : alpha(theme.palette.background.default, 0.5),
          backdropFilter: 'blur(10px)'
        }}>
          <Paper 
            elevation={0} 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              px: 2.5, 
              borderRadius: 2, 
              border: 'none',
              bgcolor: 'background.default',
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
              flex: 1, 
              minWidth: 250
            }}
          >
            <Search size={20} style={{ marginRight: 10, color: theme.palette.text.secondary }} />
            <Box 
              component="input"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              sx={{ 
                border: 'none', 
                outline: 'none', 
                py: 1.5, 
                width: '100%', 
                fontWeight: 700,
                bgcolor: 'transparent',
                color: 'text.primary',
                fontSize: '0.95rem',
                '&::placeholder': { color: 'text.disabled' }
              }} 
            />
          </Paper>
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {['all', 'info', 'success', 'warn', 'error', 'db', 'auth'].map((level) => (
              <Chip 
                key={level}
                label={level.toUpperCase()}
                onClick={() => setFilterLevel(level)}
                variant={filterLevel === level ? 'filled' : 'outlined'}
                color={level === 'all' ? 'primary' : (level === 'error' ? 'error' : (level === 'warn' ? 'warning' : 'default'))}
                sx={{ 
                  fontWeight: 900, 
                  borderRadius: 3,
                  px: 1,
                  boxShadow: filterLevel === level
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12' : '4px 4px 8px #d1d9e6')
                    : 'none'
                }}
              />
            ))}
          </Stack>
        </Box>

        <TableContainer component={Box}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.100' }}>
                <TableCell sx={{ width: 40 }} />
                <TableCell sx={{ fontWeight: 800, py: 2, color: 'text.primary' }}>Level</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>User / Email</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>Message</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary' }} align="right">Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                    <Typography variant="body1" color="text.secondary">No logs found matching your criteria</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
                      <TableCell>
                        <IconButton size="small" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                          {expandedLog === log.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          icon={getLevelIcon(log.level)}
                          label={log.level.toUpperCase()} 
                          size="small" 
                          sx={{ 
                            fontWeight: 900, 
                            fontSize: '0.65rem', 
                            bgcolor: alpha(getLevelColor(log.level), 0.1),
                            color: getLevelColor(log.level),
                            border: '1px solid',
                            borderColor: alpha(getLevelColor(log.level), 0.2)
                          }} 
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'primary.main' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, display: 'block' }}>
                          {log.userEmail || 'anonymous'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          ID: {log.userId?.substring(0, 8) || 'none'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.message}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8rem' }}>
                        {format(log.timestamp, 'MMM d, HH:mm:ss.SSS')}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>
                          {log.id.substring(0, 8)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                        <Collapse in={expandedLog === log.id} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 3, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.5) : 'grey.50', borderRadius: 2, m: 1, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Terminal size={16} /> Log Data
                            </Typography>
                            
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                              <Grid size={{ xs: 12, md: 4 }}>
                                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5), border: '1px solid', borderColor: 'divider' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 900, display: 'block', mb: 0.5, color: 'text.secondary' }}>USER IDENTITY</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Email: {log.userEmail || 'N/A'}</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>UID: {log.userId || 'N/A'}</Typography>
                                </Paper>
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5), border: '1px solid', borderColor: 'divider' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 900, display: 'block', mb: 0.5, color: 'text.secondary' }}>NETWORK & LOCATION</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>IP: {log.ip || 'Unknown'}</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Loc: {log.location || 'Unknown'}</Typography>
                                </Paper>
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5), border: '1px solid', borderColor: 'divider' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 900, display: 'block', mb: 0.5, color: 'text.secondary' }}>BROWSER & OS</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{log.browser || 'Unknown'} on {log.os || 'Unknown'}</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Device: {log.device || 'Unknown'}</Typography>
                                </Paper>
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5), border: '1px solid', borderColor: 'divider' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 900, display: 'block', mb: 0.5, color: 'text.secondary' }}>DATE & TIME</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{format(log.timestamp, 'PPPP p')}</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>Hijri: {log.islamicDate || 'N/A'}</Typography>
                                </Paper>
                              </Grid>
                            </Grid>

                            <Box component="pre" sx={{ 
                              p: 2, bgcolor: '#1e293b', color: '#e2e8f0', borderRadius: 2, 
                              overflowX: 'auto', fontSize: '0.75rem', fontFamily: 'monospace',
                              maxHeight: 400
                            }}>
                              {JSON.stringify({
                                message: log.message,
                                level: log.level,
                                timestamp: new Date(log.timestamp).toISOString(),
                                userAgent: log.userAgent,
                                data: log.data
                              }, null, 2)}
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

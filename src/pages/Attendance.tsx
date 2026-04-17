import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  Table, TableBody, TableCell, TableRow, Avatar, Checkbox, FormControl, InputLabel, 
  Select, MenuItem, CircularProgress, Chip, IconButton,
  Paper, Alert, useTheme, useMediaQuery, alpha, Stack,
  LinearProgress, Tooltip, Zoom, Snackbar, TableHead, TableContainer
} from '@mui/material';
import { 
  CheckCircle, XCircle, Calendar, Users, 
  Filter, Save, ChevronLeft, ChevronRight,
  Download, Search, UserCheck, UserMinus,
  Clock, Info, MoreVertical, FileText, TrendingUp
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, getDocs, where, setDoc, orderBy } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, Attendance } from '../types';
import { useAuth } from '../context/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subDays, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function AttendancePage() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all students
        const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
        const studentsSnap = await getDocs(studentsQuery);
        const studentsList = studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
        setStudents(studentsList);

        // Extract unique classes
        const uniqueClasses = Array.from(new Set(studentsList.map(s => s.grade).filter(Boolean)));
        setClasses(uniqueClasses);
        if (uniqueClasses.length > 0 && !selectedClass) setSelectedClass(uniqueClasses[0]);

        // Fetch attendance for selected date
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const attendanceQuery = query(collection(db, 'attendance'), where('date', '==', dateStr));
        const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
          setAttendanceData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Attendance[]);
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'attendance');
        });

        return () => unsubscribe();
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'attendance_init');
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent') => {
    if (!isTeacher) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const attendanceId = `${dateStr}_${studentId}`;
    const student = students.find(s => s.uid === studentId);
    
    try {
      await setDoc(doc(db, 'attendance', attendanceId), {
        studentId,
        studentName: student?.displayName || '',
        date: dateStr,
        status,
        markedBy: currentUser?.uid,
        markedAt: Date.now(),
        grade: selectedClass
      });
      setSnackbar({ open: true, message: `${student?.displayName} marked as ${status}`, severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `attendance/${attendanceId}`);
      setSnackbar({ open: true, message: 'Failed to mark attendance', severity: 'error' });
    }
  };

  const handleBulkMark = async (status: 'present' | 'absent') => {
    if (!isTeacher || !currentUser) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const promises = filteredStudents.map(student => {
        const attendanceId = `${dateStr}_${student.uid}`;
        return setDoc(doc(db, 'attendance', attendanceId), {
          studentId: student.uid,
          studentName: student.displayName,
          date: dateStr,
          status,
          markedBy: currentUser.uid,
          markedByName: currentUser.displayName,
          markedAt: Date.now(),
          grade: selectedClass
        });
      });
      await Promise.all(promises);
      setSnackbar({ open: true, message: `All students marked as ${status}`, severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
      setSnackbar({ open: true, message: 'Failed to bulk mark attendance', severity: 'error' });
    }
  };

  const filteredStudents = students.filter(s => 
    s.grade === selectedClass && 
    (s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
     s.studentId?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const presentCount = attendanceData.filter(a => a.status === 'present' && filteredStudents.some(s => s.uid === a.studentId)).length;
  const absentCount = attendanceData.filter(a => a.status === 'absent' && filteredStudents.some(s => s.uid === a.studentId)).length;
  const attendanceRate = filteredStudents.length > 0 ? Math.round((presentCount / filteredStudents.length) * 100) : 0;

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: { xs: 4, sm: 6, md: 8 }, px: { xs: 1.5, sm: 2, md: 0 } }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: -2, mb: 1 }}>Haziri (Attendance)</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
            Track and manage Tulab-e-Ilm daily haziri for {selectedClass}
          </Typography>
        </Box>
      </motion.div>

      {/* Stats Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SummaryCard 
            title="Haziri Rate" 
            value={`${attendanceRate}%`} 
            icon={<TrendingUp size={24} />} 
            color="primary" 
            progress={attendanceRate}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SummaryCard 
            title="Hazir (Present) Today" 
            value={presentCount} 
            icon={<UserCheck size={24} />} 
            color="success" 
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SummaryCard 
            title="Ghair Hazir (Absent) Today" 
            value={absentCount} 
            icon={<UserMinus size={24} />} 
            color="error" 
          />
        </motion.div>
      </Box>

      <Card sx={{ 
        borderRadius: 6, 
        overflow: 'hidden', 
        mb: 4,
        border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
        bgcolor: 'background.paper',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      }}>
        <CardContent sx={{ p: 0 }}>
          {/* Filters Bar */}
          <Box sx={{ 
            p: 3, 
            bgcolor: alpha(theme.palette.background.default, 0.5), 
            borderBottom: '1px solid', 
            borderColor: 'divider',
            backdropFilter: 'blur(10px)'
          }}>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 4 }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1, 
                  bgcolor: alpha(theme.palette.background.default, 0.5), 
                  p: 1, 
                  borderRadius: 100, 
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}>
                  <IconButton onClick={() => setSelectedDate(subDays(selectedDate, 1))} size="small" sx={{ 
                    bgcolor: 'background.paper',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}>
                    <ChevronLeft size={20} />
                  </IconButton>
                  <Box sx={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                    <Calendar size={20} color={theme.palette.primary.main} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {format(selectedDate, 'do MMM, yyyy')}
                    </Typography>
                  </Box>
                  <IconButton onClick={() => setSelectedDate(addDays(selectedDate, 1))} size="small" sx={{ 
                    bgcolor: 'background.paper',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}>
                    <ChevronRight size={20} />
                  </IconButton>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontWeight: 800 }}>Select Maktab Level</InputLabel>
                  <Select
                    value={selectedClass}
                    label="Select Maktab Level"
                    onChange={(e) => setSelectedClass(e.target.value)}
                    sx={{ 
                      borderRadius: 3, 
                      bgcolor: alpha(theme.palette.background.default, 0.5), 
                      fontWeight: 800,
                      '& .MuiOutlinedInput-notchedOutline': { border: `1px solid ${alpha(theme.palette.divider, 0.1)}` },
                    }}
                  >
                    {classes.map(c => <MenuItem key={c} value={c} sx={{ fontWeight: 700 }}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 5 }}>
                <Box sx={{ display: 'flex', gap: 2.5 }}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      flex: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      px: 2.5, 
                      borderRadius: 4, 
                      border: 'none',
                      bgcolor: 'background.default',
                      boxShadow: theme.palette.mode === 'dark'
                        ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                        : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                    }}
                  >
                    <Search size={20} color={theme.palette.text.secondary} />
                    <Box 
                      component="input" 
                      placeholder="Search Talib-e-Ilm..." 
                      value={searchQuery}
                      onChange={(e: any) => setSearchQuery(e.target.value)}
                      sx={{ 
                        border: 'none', 
                        outline: 'none', 
                        p: 1.5, 
                        width: '100%', 
                        fontWeight: 700,
                        bgcolor: 'transparent',
                        color: 'text.primary',
                        '&::placeholder': { color: 'text.disabled' }
                      }} 
                    />
                  </Paper>
                  {isTeacher && (
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Tooltip title="Mark All Present">
                        <IconButton 
                          onClick={() => handleBulkMark('present')}
                          sx={{ 
                            bgcolor: 'background.paper', 
                            color: 'success.main', 
                            boxShadow: theme.palette.mode === 'dark'
                              ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                              : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                            '&:hover': { bgcolor: 'success.main', color: 'white' } 
                          }}
                        >
                          <CheckCircle size={22} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mark All Absent">
                        <IconButton 
                          onClick={() => handleBulkMark('absent')}
                          sx={{ 
                            bgcolor: 'background.paper', 
                            color: 'error.main', 
                            boxShadow: theme.palette.mode === 'dark'
                              ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                              : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                            '&:hover': { bgcolor: 'error.main', color: 'white' } 
                          }}
                        >
                          <XCircle size={22} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Attendance Table */}
          <Box sx={{ overflowX: 'auto', width: '100%' }}>
            <TableContainer component={Box} sx={{ minWidth: { xs: 800, md: '100%' } }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.3) }}>
                    <TableCell sx={{ fontWeight: 800, py: 2.5, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>Talib-e-Ilm Details</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>Roll Number</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }} align="center">Status</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredStudents.map((student) => {
                      const record = attendanceData.find(a => a.studentId === student.uid);
                      return (
                        <TableRow 
                          component={motion.tr}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          key={student.uid} 
                          hover
                          sx={{ 
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                            '& .MuiTableCell-root': { borderBottom: '1px solid', borderColor: 'divider' }
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar 
                                src={student.photoURL} 
                                sx={{ 
                                  width: 40, 
                                  height: 40, 
                                  border: '2px solid', 
                                  borderColor: record?.status === 'present' ? 'success.light' : record?.status === 'absent' ? 'error.light' : 'divider' 
                                }}
                              >
                                {student.displayName.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{student.displayName}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{student.grade}</Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                              {student.studentId}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {record ? (
                              <Chip 
                                label={record.status.toUpperCase()} 
                                color={record.status === 'present' ? 'success' : 'error'} 
                                size="small" 
                                sx={{ 
                                  fontWeight: 900, 
                                  fontSize: '0.65rem', 
                                  height: 24,
                                  px: 1,
                                  boxShadow: `0 4px 12px ${alpha(record.status === 'present' ? theme.palette.success.main : theme.palette.error.main, 0.2)}`
                                }}
                              />
                            ) : (
                              <Chip 
                                label="NOT MARKED" 
                                size="small" 
                                variant="outlined" 
                                sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'text.disabled', borderColor: 'divider' }} 
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                              <Button 
                                size="small" 
                                variant={record?.status === 'present' ? 'contained' : 'outlined'}
                                color="success"
                                startIcon={<CheckCircle size={16} />}
                                onClick={() => handleMarkAttendance(student.uid, 'present')}
                                disabled={!isTeacher}
                                sx={{ 
                                  borderRadius: 3, 
                                  minWidth: { xs: 80, sm: 100 }, 
                                  fontWeight: 800,
                                  fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                                  boxShadow: record?.status === 'present' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                                }}
                              >
                                Hazir
                              </Button>
                              <Button 
                                size="small" 
                                variant={record?.status === 'absent' ? 'contained' : 'outlined'}
                                color="error"
                                startIcon={<XCircle size={16} />}
                                onClick={() => handleMarkAttendance(student.uid, 'absent')}
                                disabled={!isTeacher}
                                sx={{ 
                                  borderRadius: 3, 
                                  minWidth: { xs: 80, sm: 100 }, 
                                  fontWeight: 800,
                                  fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                                  boxShadow: record?.status === 'absent' ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none'
                                }}
                              >
                                Ghair Hazir
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          
          {filteredStudents.length === 0 && (
            <Box sx={{ p: 10, textAlign: 'center' }}>
              <Users size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No Tulab-e-Ilm found</Typography>
              <Typography variant="body2" color="text.secondary">Try adjusting your filters or search query</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {!isTeacher && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Clock size={20} color={theme.palette.primary.main} /> Your Haziri History
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ borderRadius: 5, p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Monthly Overview</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <Typography key={i} variant="caption" align="center" sx={{ fontWeight: 800, color: 'text.disabled' }}>{day}</Typography>
                  ))}
                  {Array.from({ length: 31 }).map((_, i) => (
                    <Box 
                      key={i} 
                      sx={{ 
                        aspectRatio: '1/1', 
                        borderRadius: 2, 
                        bgcolor: i % 5 === 0 ? 'error.light' : 'success.light',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { transform: 'scale(1.1)' }
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 800, color: i % 5 === 0 ? 'error.dark' : 'success.dark' }}>{i + 1}</Typography>
                    </Box>
                  ))}
                </Box>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ borderRadius: 5, p: 3, height: '100%', bgcolor: 'primary.main', color: 'white' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Quick Stats</Typography>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700 }}>Total Working Days</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>24</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700 }}>Days Hazir</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>22</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700 }}>Ghair Haziri</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>2</Typography>
                  </Box>
                </Stack>
                <Button 
                  fullWidth 
                  variant="contained" 
                  sx={{ mt: 4, bgcolor: 'white', color: 'primary.main', fontWeight: 800, '&:hover': { bgcolor: 'grey.100' } }}
                  startIcon={<FileText size={18} />}
                >
                  Download Summary
                </Button>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          sx={{ width: '100%', borderRadius: 3, fontWeight: 700 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

const SummaryCard = React.memo(({ title, value, icon, color, progress }: any) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const mainColor = theme.palette[color as 'primary' | 'success' | 'error'].main;
  
  return (
    <Card sx={{ 
      borderRadius: 6, 
      height: '100%', 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
      bgcolor: 'background.paper',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
      '&:hover': { 
        transform: 'translateY(-6px)', 
        borderColor: alpha(mainColor, 0.3),
        boxShadow: `0 20px 40px ${alpha(mainColor, 0.1)}`,
      }
    }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: 3, 
            bgcolor: alpha(mainColor, 0.1), 
            color: mainColor,
            display: 'flex',
            border: `1px solid ${alpha(mainColor, 0.15)}`
          }}>
            {icon}
          </Box>
          <IconButton size="small" sx={{ 
            bgcolor: alpha(theme.palette.background.default, 0.5),
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}>
            <MoreVertical size={18} />
          </IconButton>
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, letterSpacing: -2 }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.75rem', mb: progress !== undefined ? 2.5 : 0 }}>{title}</Typography>
        
        {progress !== undefined && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: mainColor }}>Monthly Target</Typography>
              <Typography variant="caption" sx={{ fontWeight: 900 }}>85%</Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 10, 
                borderRadius: 5, 
                bgcolor: alpha(theme.palette.background.default, 0.5),
                border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: mainColor }
              }} 
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

import React, { useState, useMemo, useEffect } from 'react';
import { Box, Grid, Card, Typography, Button, Chip, Avatar, IconButton, TextField, InputAdornment, Stack, useTheme, Skeleton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, CircularProgress, useMediaQuery, Checkbox } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Search, Plus, Trash2, Save, Check, X, FileText, Download, Printer, Eye } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';
import FeeReceiptModal from '../components/FeeReceiptModal';
import { FeeReceipt, InstituteSettings } from '../types';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { BulkReceiptPDF } from '../components/FeeReceiptModal';
import QRCode from 'qrcode';

const Fees = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { receipts, users, loading: dataLoading, setIsSaving, isSaving } = useData();
  const { user: currentUser, instituteSettings } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [amount, setAmount] = useState('');
  const [feeHead, setFeeHead] = useState<FeeReceipt['feeHead']>('Monthly Fee');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [remarks, setRemarks] = useState('');
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [viewingReceipt, setViewingReceipt] = useState<FeeReceipt | null>(null);
  const [bulkQrCodes, setBulkQrCodes] = useState<Record<string, string>>({});
  const [isPreparingBulk, setIsPreparingBulk] = useState(false);

  const navigate = () => {}; // Placeholder if needed

  useEffect(() => {
    if (selectedReceipts.length > 0) {
      const generateQR = async () => {
        setIsPreparingBulk(true);
        const codes: Record<string, string> = { ...bulkQrCodes };
        for (const id of selectedReceipts) {
          if (!codes[id]) {
            const r = receipts.find(receipt => receipt.id === id);
            if (r) {
              const verificationLink = `https://${window.location.host}/verify/receipt/${r.receiptNo || r.id}`;
              codes[id] = await QRCode.toDataURL(verificationLink, { margin: 1, width: 200 });
            }
          }
        }
        setBulkQrCodes(codes);
        setIsPreparingBulk(false);
      };
      generateQR();
    }
  }, [selectedReceipts]);

  // Permission logic
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin' || currentUser?.role === 'manager' || currentUser?.role === 'muntazim';

  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      const student = users.find(u => u.uid === r.studentId);
      const studentName = student?.displayName || 'Unknown';
      return studentName.toLowerCase().includes(searchQuery.toLowerCase()) || r.receiptNo?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [receipts, users, searchQuery]);

  const handleCreate = async () => {
    if ((!isGuest && !selectedStudent) || (isGuest && !guestName) || !amount) return;
    setIsSaving(true);
    try {
      const student = !isGuest ? users.find(u => u.uid === selectedStudent) : null;
      const transId = `TXN-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
      const receiptNo = `${instituteSettings?.receiptPrefix || 'REC'}-${Date.now().toString().slice(-6)}`;
      
      const newReceipt: any = {
        studentId: isGuest ? 'GUEST' : selectedStudent,
        studentName: isGuest ? guestName : (student?.displayName || 'Unknown'),
        studentOfficialId: isGuest ? 'GUEST' : (student?.studentId || student?.admissionNo || ''),
        amount: Number(amount),
        feeHead,
        month: feeHead === 'Monthly Fee' ? selectedMonth : '',
        method: 'Cash',
        paymentMode: 'Cash',
        status: isAdmin ? 'approved' : 'pending',
        date,
        remarks,
        transactionId: transId,
        receiptNo,
        receiptNumber: receiptNo,
        createdAt: Timestamp.now().toMillis(),
        createdBy: currentUser?.uid,
        createdByName: currentUser?.displayName || 'System',
        approvedBy: isAdmin ? currentUser?.uid : null,
        approvedByName: isAdmin ? (currentUser?.displayName || 'System') : null,
        approvedAt: isAdmin ? Timestamp.now().toMillis() : null
      };

      await addDoc(collection(db, 'receipts'), newReceipt);
      setIsModalOpen(false);
      setAmount('');
      setGuestName('');
      setRemarks('');
      setSelectedStudent('');
      setIsGuest(false);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleDelete = async () => {
    if (!receiptToDelete) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'receipts', receiptToDelete));
      setDeleteConfirmOpen(false);
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  if (dataLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 4, m: 2 }} />;

  return (
    <Box sx={{ pb: 16, pt: 2 }}>
      <ConfirmDialog isOpen={deleteConfirmOpen} title="Delete Fee Record?" message="Delete this permanenly?" onConfirm={handleDelete} onCancel={() => setDeleteConfirmOpen(false)} />
      <FeeReceiptModal open={!!viewingReceipt} onClose={() => setViewingReceipt(null)} receipt={viewingReceipt} settings={instituteSettings} />
      
      <Stack spacing={3} sx={{ px: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 950 }}>Fees & Payments</Typography>
            <Typography variant="caption" color="text.secondary">Manage student tuition and guest contributions</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {selectedReceipts.length > 0 && (
              <PDFDownloadLink
                document={
                  <BulkReceiptPDF 
                    receipts={receipts.filter(r => selectedReceipts.includes(r.id!)) as FeeReceipt[]} 
                    settings={instituteSettings!} 
                    qrCodeUrls={bulkQrCodes} 
                  />
                }
                fileName={`Bulk_Receipts_${format(new Date(), 'dd_MMM_yy')}.pdf`}
                style={{ textDecoration: 'none' }}
              >
                {({ loading }) => (
                  <Button 
                    variant="outlined" 
                    startIcon={loading || isPreparingBulk ? <CircularProgress size={16} /> : <Download size={18} />}
                    disabled={loading || isPreparingBulk}
                  >
                    {loading || isPreparingBulk ? 'Preparing PDF...' : `Download Bulk (${selectedReceipts.length})`}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
            {isAdmin && <Button variant="contained" size={isMobile ? "small" : "medium"} startIcon={<Plus size={18} />} onClick={() => setIsModalOpen(true)}>Record Fee</Button>}
          </Stack>
        </Box>

        <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell padding="checkbox">
                  <Checkbox 
                    checked={selectedReceipts.length === filteredReceipts.length && filteredReceipts.length > 0} 
                    indeterminate={selectedReceipts.length > 0 && selectedReceipts.length < filteredReceipts.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedReceipts(filteredReceipts.map(r => r.id!));
                      else setSelectedReceipts([]);
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Student/Payer</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReceipts.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox 
                      checked={selectedReceipts.includes(r.id!)} 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedReceipts(prev => [...prev, r.id!]);
                        else setSelectedReceipts(prev => prev.filter(id => id !== r.id));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 800 }}>{r.studentName}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.receiptNo || r.receiptNumber}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={r.feeHead || 'Monthly Fee'} variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>₹{r.amount?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{format(new Date(r.date), 'dd/MM/yyyy')}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      size="small" 
                      label={(r.status || 'pending').toUpperCase()} 
                      color={r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'error'} 
                      sx={{ fontWeight: 800, fontSize: '0.7rem' }} 
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton onClick={() => setViewingReceipt(r as FeeReceipt)} size="small" color="primary"><Eye size={18} /></IconButton>
                      {(r.status === 'pending' || !r.status) && (currentUser?.role === 'superadmin' || currentUser?.role === 'manager' || currentUser?.role === 'mudeer' || currentUser?.role === 'mudaris') && (
                        <IconButton 
                          onClick={async () => {
                            setIsSaving(true);
                            try {
                              const { doc, updateDoc } = await import('firebase/firestore');
                              await updateDoc(doc(db, 'receipts', r.id!), { 
                                status: 'approved',
                                approvedBy: currentUser?.uid,
                                approvedByName: currentUser?.displayName,
                                approvedAt: Date.now()
                              });
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setIsSaving(false);
                            }
                          }} 
                          size="small" 
                          color="success"
                        >
                          <Check size={18} />
                        </IconButton>
                      )}
                      <IconButton onClick={() => { setReceiptToDelete(r.id!); setDeleteConfirmOpen(true); }} size="small" color="error"><Trash2 size={18} /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filteredReceipts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No fee records found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>New Fee Payment</DialogTitle>
        <DialogContent sx={{ p: 3, pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <FormControl fullWidth>
            <InputLabel shrink>Payer Type</InputLabel>
            <Select 
              value={isGuest ? 'guest' : 'registered'} 
              onChange={e => setIsGuest(e.target.value === 'guest')}
              label="Payer Type"
              notched
            >
              <MenuItem value="registered">Registered Student</MenuItem>
              <MenuItem value="guest">General / Guest</MenuItem>
            </Select>
          </FormControl>

          {!isGuest ? (
            <FormControl fullWidth>
              <InputLabel shrink>Select Student</InputLabel>
              <Select 
                value={selectedStudent} 
                onChange={e => setSelectedStudent(e.target.value as string)}
                label="Select Student"
                notched
              >
                {users.filter(u => u.role === 'student').map(s => (
                  <MenuItem key={s.uid} value={s.uid}>
                    {s.displayName} ({s.studentId || s.admissionNo || 'No ID'})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <TextField label="Guest Name" fullWidth value={guestName} onChange={e => setGuestName(e.target.value)} InputLabelProps={{ shrink: true }} />
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel shrink>Fee Category</InputLabel>
                <Select 
                  value={feeHead} 
                  onChange={e => setFeeHead(e.target.value as any)}
                  label="Fee Category"
                  notched
                >
                  <MenuItem value="Monthly Fee">Monthly Fee</MenuItem>
                  <MenuItem value="Admission Fee">Admission Fee</MenuItem>
                  <MenuItem value="Quran / Hifz Fee">Quran / Hifz Fee</MenuItem>
                  <MenuItem value="Exam / Test Fee">Exam / Test Fee</MenuItem>
                  <MenuItem value="Book Fee">Book Fee</MenuItem>
                  <MenuItem value="Sadqa / Donation">Sadqa / Donation</MenuItem>
                  <MenuItem value="Others">Others</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                label="Amount (₹)" 
                type="number" 
                fullWidth 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
              />
            </Grid>
          </Grid>

          {feeHead === 'Monthly Fee' && (
            <TextField 
              label="Fee Month" 
              type="month" 
              fullWidth 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)} 
              InputLabelProps={{ shrink: true }}
            />
          )}

          <TextField 
            label="Payment Date" 
            type="date" 
            fullWidth 
            value={date} 
            onChange={e => setDate(e.target.value)} 
            InputLabelProps={{ shrink: true }}
          />

          <TextField 
            label="Remarks / Notes" 
            multiline 
            rows={2} 
            fullWidth 
            value={remarks} 
            onChange={e => setRemarks(e.target.value)} 
            placeholder="Optional notes about the payment"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setIsModalOpen(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={isSaving} sx={{ fontWeight: 900, px: 4 }}>
            {isSaving ? 'Recording...' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Fees;

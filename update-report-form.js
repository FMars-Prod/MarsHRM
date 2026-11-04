const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/reports/page.tsx', 'utf8');

// 1. Create LiveLocationDisplayInForm component that fetches today's checkIn/checkOut coordinates and displays them right inside the form
const liveLocationComp = `
const LiveLocationDisplayInForm = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const todayId = format(new Date(), 'yyyy-MM-dd');
    const attRef = useMemoFirebase(() => user ? doc(firestore, \`users/\${user.uid}/attendances\`, todayId) : null, [user, firestore, todayId]);
    const { data: todayAttendance } = useDoc<any>(attRef);

    const hasCheckIn = todayAttendance?.locationCheckInLatitude != null;
    const hasCheckOut = todayAttendance?.locationCheckOutLatitude != null;

    return (
        <Card className="border-none ring-1 ring-primary/20 bg-gradient-to-r from-primary/5 via-white to-primary/5 rounded-none shadow-sm mb-6 text-left">
            <CardHeader className="bg-muted/10 py-3 px-4 border-b border-border/40">
                <CardTitle className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <MapPin className="size-3.5" /> 📍 Verified Attendance Coordinates & Work Location
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                    {/* Check In Location Box */}
                    <div className="p-3 bg-white border border-border/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1">
                                <LocateFixed className="size-3 text-emerald-600" /> Clock-In Location
                            </span>
                            {todayAttendance?.isOutOfRange ? (
                                <Badge className="bg-amber-100 text-amber-800 text-[7px] font-black uppercase rounded-none border-none px-1.5 h-4">Outside Office</Badge>
                            ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[7px] font-black uppercase rounded-none border-none px-1.5 h-4">Office / Authorized</Badge>
                            )}
                        </div>
                        <p className="text-xs font-black uppercase text-slate-800">
                            {todayAttendance?.locationCheckInType || (todayAttendance?.isAtHome ? 'Home (WFH)' : (todayAttendance?.isOutOfRange ? 'Outside (Direct)' : 'Office Geofence'))}
                        </p>
                        {hasCheckIn ? (
                            <div className="space-y-0.5">
                                <p className="font-mono text-[9px] font-bold text-slate-600">
                                    {Number(todayAttendance.locationCheckInLatitude).toFixed(5)}, {Number(todayAttendance.locationCheckInLongitude).toFixed(5)}
                                </p>
                                <a 
                                    href={\`https://www.google.com/maps?q=\${todayAttendance.locationCheckInLatitude},\${todayAttendance.locationCheckInLongitude}\`}
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-[8px] font-black uppercase text-primary hover:underline flex items-center gap-1 pt-0.5"
                                >
                                    <ExternalLink className="size-2.5" /> View On Map
                                </a>
                            </div>
                        ) : (
                            <p className="text-[9px] font-bold text-muted-foreground italic uppercase">Coordinates captured during clock-in</p>
                        )}
                    </div>

                    {/* Check Out Location Box */}
                    <div className="p-3 bg-white border border-border/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1">
                                <Navigation className="size-3 text-rose-600" /> Clock-Out Location
                            </span>
                            <Badge className="bg-slate-100 text-slate-700 text-[7px] font-black uppercase rounded-none border-none px-1.5 h-4">Shift End</Badge>
                        </div>
                        <p className="text-xs font-black uppercase text-slate-800">
                            {todayAttendance?.locationCheckOutType || 'Current Device Coordinates'}
                        </p>
                        {hasCheckOut ? (
                            <div className="space-y-0.5">
                                <p className="font-mono text-[9px] font-bold text-slate-600">
                                    {Number(todayAttendance.locationCheckOutLatitude).toFixed(5)}, {Number(todayAttendance.locationCheckOutLongitude).toFixed(5)}
                                </p>
                                <a 
                                    href={\`https://www.google.com/maps?q=\${todayAttendance.locationCheckOutLatitude},\${todayAttendance.locationCheckOutLongitude}\`}
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-[8px] font-black uppercase text-primary hover:underline flex items-center gap-1 pt-0.5"
                                >
                                    <ExternalLink className="size-2.5" /> View On Map
                                </a>
                            </div>
                        ) : (
                            <p className="text-[9px] font-bold text-slate-500 italic uppercase">Will record coordinates automatically on submit</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
`;

code = code.replace('const ShiftHeaderFields = () => {', `${liveLocationComp}\nconst ShiftHeaderFields = () => {`);

// 2. Put <LiveLocationDisplayInForm /> inside ShiftHeaderFields so it automatically shows in Business, Technical, HR, and Marketing forms!
code = code.replace(
  `const ShiftHeaderFields = () => {
    const { control } = useFormContext();
    return (
        <div className="grid grid-cols-2 gap-6 mb-8 text-left">`,
  `const ShiftHeaderFields = () => {
    const { control } = useFormContext();
    return (
        <div className="space-y-4 mb-8 text-left">
            <LiveLocationDisplayInForm />
            <div className="grid grid-cols-2 gap-6 text-left">`
);

// Close the wrapper div
code = code.replace(
  `            <FormField control={control} name="logOutTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Shift End</FormLabel>
                    <FormControl><Input type="time" {...field} className="rounded-none h-11" /></FormControl>
                </FormItem>
            )} />
        </div>`,
  `            <FormField control={control} name="logOutTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Shift End</FormLabel>
                    <FormControl><Input type="time" {...field} className="rounded-none h-11" /></FormControl>
                </FormItem>
            )} />
            </div>
        </div>`
);

fs.writeFileSync('src/app/dashboard/reports/page.tsx', code, 'utf8');
console.log('Successfully updated reports form to show Location Log inside the submission modal!');


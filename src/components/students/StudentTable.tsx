import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { getDisplayPhone, getDisplayEmail, getPhoneSource, getEmailSource } from "@/lib/studentUtils";

interface StudentTableProps {
  students: any[];
  onEdit: (student: any) => void;
  onDelete: (id: number) => void;
}

const StudentTable = ({ students, onEdit, onDelete }: StudentTableProps) => (
  <Card className="glass-card">
    <CardContent className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="hidden lg:table-cell">Account Holder</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={student.photo || undefined} />
                    <AvatarFallback className="text-xs">{student.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{student.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-foreground">{getDisplayPhone(student)}</span>
                  {getPhoneSource(student) && <span className="text-xs text-muted-foreground">{getPhoneSource(student)}</span>}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-col">
                  <span className="text-foreground">{getDisplayEmail(student)}</span>
                  {getEmailSource(student) && <span className="text-xs text-muted-foreground">{getEmailSource(student)}</span>}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">{student.users?.name || "—"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(student)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(student.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {students.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No students found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

export default StudentTable;

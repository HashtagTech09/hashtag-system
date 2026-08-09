import AdminLayout from "@/components/AdminLayout";
import RegisterPage from "./Register";

const InternalRegisterPage = () => {
  return (
    <AdminLayout title="Registration Portal">
      <RegisterPage embedded />
    </AdminLayout>
  );
};

export default InternalRegisterPage;

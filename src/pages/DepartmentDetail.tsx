import { useParams, Navigate } from 'react-router-dom';
import ArchitecturalCivil from './departments/ArchitecturalCivil';
import Mechanical from './departments/Mechanical';
import Electrical from './departments/Electrical';
import ICT from './departments/ICT';
import MaterialTesting from './departments/MaterialTesting';
import Consultancy from './departments/Consultancy';

const DepartmentDetail = () => {
  const { departmentId } = useParams();

  const departmentComponents: Record<string, React.ComponentType> = {
    'architecture': ArchitecturalCivil,
    'mechanical': Mechanical,
    'electrical': Electrical,
    'ict': ICT,
    'testing': MaterialTesting,
    'consultancy': Consultancy,
  };

  const DepartmentComponent = departmentComponents[departmentId || ''];

  if (!DepartmentComponent) {
    return <Navigate to="/departments" replace />;
  }

  return <DepartmentComponent />;
};

export default DepartmentDetail;
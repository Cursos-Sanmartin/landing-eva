import {useEffect , useState}  from 'react';
import { getProjects } from '../../data/getProjects';
import ProjectCard from '../ProjectCard/ProjectCard';
import './Projects.css';

function Projects() {
    const [projects, setProjects] = useState([]);

       useEffect(() => {
        let active = true;

        getProjects().then((data) => {
            if (active) {
                setProjects(data);
            }
        });

        return () => {
            active = false;
        };
    }, []);

    return (
         <section id="proyectos" className="projects">
      <div className="wrap">
        <span className="kicker">Proyectos</span>
        <h2>Lo que crearon los chicos</h2>

        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
    );
};



export default Projects;
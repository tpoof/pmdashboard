<style>
    #headerMenu_links_list {
        gap: 8px;
    }

    #headerMenu_links_list .leafDashBtn {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid var(--border, #dbe1e8);
        background: var(--surface, #ffffff);
        box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
        text-decoration: none;
        color: var(--text, #1f2933);
        font-weight: 700;
        transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }

    #headerMenu_links_list .leafDashBtn--primary {
        background: var(--surface, #ffffff);
        border-color: var(--border, #dbe1e8);
        color: var(--accent-strong, #1d4ed8);
    }

    #headerMenu_links_list .leafDashBtn:hover,
    #headerMenu_links_list .leafDashBtn:focus {
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
        background: var(--accent-strong, #1d4ed8);
        border-color: var(--accent-strong, #1d4ed8);
        color: #ffffff !important;
    }

    #headerMenu_links_list .leafDashBtn:hover .leafDashBtn__title,
    #headerMenu_links_list .leafDashBtn:hover .leafDashBtn__desc,
    #headerMenu_links_list .leafDashBtn:focus .leafDashBtn__title,
    #headerMenu_links_list .leafDashBtn:focus .leafDashBtn__desc {
        color: #ffffff !important;
    }

    #headerMenu_links_list .leafDashBtn:focus-visible {
        outline: 2px solid var(--focus, #0b5cab);
        outline-offset: 2px;
    }

    #headerMenu_links_list .leafDashBtn__title {
        font-size: 14px;
        line-height: 1.2;
    }

    #headerMenu_links_list .leafDashBtn__desc {
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
        opacity: 0.9;
    }
</style>

<ul id="headerMenu_links_list">
    <li>
        <a href="report.php?a=help" class="leafDashBtn leafDashBtn--primary" role="button">
            <span class="leafDashBtn__title">Dashboard Help &amp; Instructions</span>
            <span class="leafDashBtn__desc">How to use the Project Dashboard — features, workflows, and tips</span>
        </a>
    </li>
    <li>
        <a href="https://github.com/stephluma/LEAF/blob/main/projects/executive_summary.md" target="_blank" rel="noopener noreferrer" class="leafDashBtn" role="button">
            <span class="leafDashBtn__title">Project Dashboard Executive Summary</span>
            <span class="leafDashBtn__desc">GitHub Documentation</span>
        </a>
    </li>
    <li>
        <a href="https://github.com/stephluma/LEAF/blob/main/projects/technical_design.md" target="_blank" rel="noopener noreferrer" class="leafDashBtn" role="button">
            <span class="leafDashBtn__title">Project Dashboard Technical Documentation</span>
            <span class="leafDashBtn__desc">GitHub Documentation</span>
        </a>
    </li>
</ul>

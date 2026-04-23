// ============================================================
//  MUCURUZI — DashboardView.js
//  Role router — reads user role and delegates to correct dash.
// ============================================================

const DashboardView = (() => {

  const render = (user, root) => {
    switch (user.role) {
      case ROLES.MANUFACTURER: ManufacturerDash.render(user, root); break;
      case ROLES.DISTRIBUTOR:  DistributorDash.render(user, root);  break;
      case ROLES.RETAILER:     RetailerDash.render(user, root);     break;
      case ROLES.BUYER:        BuyerDash.render(user, root);        break;
      default:
        root.innerHTML = `<div class="empty-state"><p>Unknown role.</p></div>`;
    }
  };

  return { render };

})();
